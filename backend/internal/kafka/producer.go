package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"gempa-sentinel/internal/config"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Producer wraps the Confluent Kafka producer
type Producer struct {
	producer *kafka.Producer
	cfg      *config.Config
}

// NewProducer creates a new Kafka producer for Confluent Cloud
func NewProducer(cfg *config.Config) (*Producer, error) {
	if cfg.DemoMode {
		log.Println("[INFO] Running in DEMO MODE - Kafka producer simulated (direct SSE broadcast)")
		return &Producer{cfg: cfg}, nil
	}

	p, err := kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers":  cfg.BootstrapServers,
		"security.protocol":  "SASL_SSL",
		"sasl.mechanisms":    "PLAIN",
		"sasl.username":      cfg.KafkaAPIKey,
		"sasl.password":      cfg.KafkaAPISecret,
		"acks":               "all",
		"enable.idempotence": true,
		"linger.ms":          5,
		"compression.type":   "snappy",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create producer: %w", err)
	}

	prod := &Producer{
		producer: p,
		cfg:      cfg,
	}

	// Start delivery report handler
	go prod.handleDeliveryReports()

	log.Println("[INFO] Kafka producer connected to Confluent Cloud")
	return prod, nil
}

// handleDeliveryReports processes delivery confirmations
func (p *Producer) handleDeliveryReports() {
	for e := range p.producer.Events() {
		switch ev := e.(type) {
		case *kafka.Message:
			if ev.TopicPartition.Error != nil {
				log.Printf("[ERROR] Delivery failed to %s: %v", *ev.TopicPartition.Topic, ev.TopicPartition.Error)
			}
		case kafka.Error:
			log.Printf("[ERROR] Kafka producer error: %v", ev)
		}
	}
}

// Produce sends a message to the specified topic
func (p *Producer) Produce(topic string, key string, value interface{}) error {
	if p == nil || p.producer == nil {
		return nil
	}

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	var keyBytes []byte
	if key != "" {
		keyBytes = []byte(key)
	}

	err = p.producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &topic,
			Partition: kafka.PartitionAny,
		},
		Key:   keyBytes,
		Value: data,
	}, nil)

	if err != nil {
		return fmt.Errorf("failed to produce to %s: %w", topic, err)
	}

	return nil
}

// CreateTopics verifies and ensures all required Kafka topics exist in Confluent Cloud
func (p *Producer) CreateTopics() error {
	if p == nil || (p.cfg != nil && p.cfg.DemoMode) {
		return nil
	}

	// Create dedicated AdminClient with separate connection so it does not interfere
	// with the Producer's handle or idempotence PID acquisition.
	adminClient, err := kafka.NewAdminClient(&kafka.ConfigMap{
		"bootstrap.servers": p.cfg.BootstrapServers,
		"security.protocol": "SASL_SSL",
		"sasl.mechanisms":   "PLAIN",
		"sasl.username":     p.cfg.KafkaAPIKey,
		"sasl.password":     p.cfg.KafkaAPISecret,
	})
	if err != nil {
		return fmt.Errorf("failed to create admin client: %w", err)
	}
	defer adminClient.Close()

	// First query cluster metadata to check existing topics
	meta, err := adminClient.GetMetadata(nil, true, 5000)
	existing := make(map[string]bool)
	if err == nil && meta != nil {
		for name, topMeta := range meta.Topics {
			if topMeta.Error.Code() == kafka.ErrNoError && len(topMeta.Partitions) > 0 {
				existing[name] = true
			}
		}
	} else if err != nil {
		log.Printf("[WARN] Failed to fetch Kafka metadata: %v. Will attempt topic creation.", err)
	}

	allTopics := append(config.AllSourceTopics(), config.AllOutputTopics()...)
	var missingTopics []kafka.TopicSpecification
	for _, t := range allTopics {
		if !existing[t] {
			missingTopics = append(missingTopics, kafka.TopicSpecification{
				Topic:             t,
				NumPartitions:     3,
				ReplicationFactor: 3,
			})
		}
	}

	if len(missingTopics) == 0 {
		log.Printf("[INFO] All %d Kafka topics verified in Confluent Cloud", len(allTopics))
		return nil
	}

	log.Printf("[INFO] Creating %d missing Kafka topics in Confluent Cloud: %v", len(missingTopics), missingTopics)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	results, err := adminClient.CreateTopics(ctx, missingTopics)
	if err != nil {
		log.Printf("[WARN] AdminClient CreateTopics: %v", err)
		return nil
	}

	for _, res := range results {
		if res.Error.Code() != kafka.ErrNoError && res.Error.Code() != kafka.ErrTopicAlreadyExists {
			log.Printf("[INFO] Topic %s status: %v", res.Topic, res.Error)
		}
	}

	log.Println("[INFO] Kafka topics created and verified in Confluent Cloud")
	return nil
}

// Flush waits for all messages to be delivered
func (p *Producer) Flush() {
	if p != nil && p.producer != nil {
		p.producer.Flush(5000)
	}
}

// Close shuts down the producer
func (p *Producer) Close() {
	if p != nil && p.producer != nil {
		p.producer.Flush(10000)
		p.producer.Close()
		log.Println("[INFO] Kafka producer closed")
	}
}
