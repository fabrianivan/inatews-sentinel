import type { BMKGGempaDetail, TsunamiScenario, TsunamiAffectedZoneDetail, InfrastructureDamageDetail } from '@/lib/types';

/**
 * Derives a realistic Tsunami & Infrastructure Damage Assessment based on real BMKG earthquake telemetry.
 * If magnitude >= 6.8, shallow depth (<70km), and potentially tsunamigenic region,
 * or if BMKG issues a tsunami potential warning,
 * returns an active tsunami scenario with computed coastal impact zones and infrastructure damages.
 */
export function deriveRealTsunamiAndDamage(
  latestQuake: BMKGGempaDetail | null,
  tsunamiStreamEvent?: TsunamiScenario | null
): TsunamiScenario | null {
  // If backend SSE has sent an explicit tsunami scenario that is active, prioritize it
  if (tsunamiStreamEvent?.active) {
    return tsunamiStreamEvent;
  }

  if (!latestQuake) return null;

  const mag = parseFloat(latestQuake.Magnitude) || 0;
  const depth = parseFloat(latestQuake.Kedalaman?.replace(/[^0-9.]/g, '') || '10') || 10;
  const potensi = (latestQuake.Potensi || '').toLowerCase();
  const wilayah = latestQuake.Wilayah || '';

  const hasTsunamiWarning =
    !potensi.includes('tidak berpotensi') &&
    !potensi.includes('tidak ada potensi') &&
    (
      potensi.includes('berpotensi tsunami') ||
      potensi.includes('waspada tsunami') ||
      potensi.includes('siaga tsunami') ||
      potensi.includes('awas tsunami')
    );

  // Trigger evaluation: official BMKG potential OR major shallow earthquake M>=6.8 depth<=70km
  const isTsunamigenic = hasTsunamiWarning || (mag >= 6.8 && depth <= 70);

  if (!isTsunamigenic) {
    return null;
  }

  // Parse epicenter coordinates
  const coords = (latestQuake.Coordinates || '').split(',');
  const lat = coords.length === 2 ? parseFloat(coords[0]) : -6.5;
  const lon = coords.length === 2 ? parseFloat(coords[1]) : 105.0;

  // Determine regional coastal zones & infrastructure based on epicenter location
  const isSundaBanten = lat >= -8.5 && lat <= -4.5 && lon >= 102.0 && lon <= 107.5;
  const isSumatraWest = lat >= -6.0 && lat <= 6.0 && lon >= 93.0 && lon <= 102.0 && !isSundaBanten;
  const isJavaSouth = lat >= -11.0 && lat <= -7.0 && lon >= 106.0 && lon <= 116.0;
  const isSulawesiMaluku = lat >= -5.0 && lat <= 4.0 && lon >= 118.0 && lon <= 132.0;

  let waveEstimatedMax = Math.min(9.2, Math.max(1.5, (mag - 6.5) * 2.2));
  if (depth < 20) waveEstimatedMax += 0.8;

  let affectedZones: string[] = [];
  let zoneDetails: TsunamiAffectedZoneDetail[] = [];
  let infraDetails: InfrastructureDamageDetail[] = [];

  if (isSundaBanten) {
    affectedZones = [
      'Pesisir Pandeglang / Ujung Kulon (Banten)',
      'Kalianda & Pesisir Lampung Selatan (Lampung)',
      'Kawasan Wisata Anyer & Carita (Banten)',
      'Pesisir Tanggamus & Teluk Semangka (Lampung)',
      'Pesisir Cilacap (Jawa Tengah)',
    ];
    zoneDetails = [
      {
        zone: 'Pandeglang & Semenanjung Ujung Kulon',
        province: 'Banten',
        estimated_eta: '18 - 25 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.9).toFixed(1)} - ${(waveEstimatedMax * 1.2).toFixed(1)} Meter`,
        status: mag >= 7.5 ? 'AWAS' : 'SIAGA',
        inundation_depth: 'Hingga 500m ke daratan',
        population_at_risk: '48.200 Jiwa',
        safe_elevation: '> 25 Meter dpl',
        coords: [-6.85, 105.45],
        polygon: [
          [-6.72, 105.20],
          [-6.65, 105.45],
          [-6.85, 105.65],
          [-7.00, 105.50],
          [-6.90, 105.15],
        ],
      },
      {
        zone: 'Kalianda & Pesisir Lampung Selatan',
        province: 'Lampung',
        estimated_eta: '22 - 30 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.8).toFixed(1)} - ${(waveEstimatedMax * 1.0).toFixed(1)} Meter`,
        status: mag >= 7.5 ? 'AWAS' : 'SIAGA',
        inundation_depth: 'Hingga 400m ke daratan',
        population_at_risk: '64.500 Jiwa',
        safe_elevation: '> 20 Meter dpl',
        coords: [-5.75, 105.58],
        polygon: [
          [-5.60, 105.50],
          [-5.75, 105.70],
          [-5.90, 105.65],
          [-5.80, 105.40],
        ],
      },
      {
        zone: 'Anyer, Carita & Labuan',
        province: 'Banten',
        estimated_eta: '28 - 36 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.6).toFixed(1)} - ${(waveEstimatedMax * 0.85).toFixed(1)} Meter`,
        status: 'SIAGA',
        inundation_depth: 'Hingga 280m ke daratan',
        population_at_risk: '32.100 Jiwa',
        safe_elevation: '> 18 Meter dpl',
        coords: [-6.20, 105.82],
        polygon: [
          [-6.05, 105.80],
          [-6.15, 105.95],
          [-6.35, 105.85],
          [-6.25, 105.75],
        ],
      },
      {
        zone: 'Pesisir Tanggamus & Teluk Semangka',
        province: 'Lampung',
        estimated_eta: '32 - 42 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.5).toFixed(1)} - ${(waveEstimatedMax * 0.7).toFixed(1)} Meter`,
        status: 'WASPADA',
        inundation_depth: 'Hingga 200m ke daratan',
        population_at_risk: '28.900 Jiwa',
        safe_elevation: '> 15 Meter dpl',
        coords: [-5.55, 104.70],
        polygon: [
          [-5.45, 104.55],
          [-5.55, 104.90],
          [-5.70, 104.75],
          [-5.60, 104.45],
        ],
      },
      {
        zone: 'Pesisir Cilacap & Teluk Penyu',
        province: 'Jawa Tengah',
        estimated_eta: '45 - 55 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.35).toFixed(1)} - ${(waveEstimatedMax * 0.5).toFixed(1)} Meter`,
        status: 'WASPADA',
        inundation_depth: 'Hingga 120m ke daratan',
        population_at_risk: '76.000 Jiwa',
        safe_elevation: '> 10 Meter dpl',
        coords: [-7.74, 109.02],
        polygon: [
          [-7.68, 108.95],
          [-7.70, 109.15],
          [-7.82, 109.12],
          [-7.80, 108.92],
        ],
      },
    ];
    infraDetails = [
      {
        facility: 'Pelabuhan Penyeberangan Merak - Bakauheni',
        type: 'Pelabuhan Utama Nasional',
        location: 'Selat Sunda (Banten & Lampung)',
        damage_level: mag >= 7.5 ? 'HEAVY' : 'MODERATE',
        loss_estimate: 'Dermaga & fender kapal terendam limpasan gelombang pasang',
        operational_status: 'DIHENTIKAN SEMENTARA (SUSPENDED)',
        critical_action: 'Instruksikan seluruh armada kapal feri bermanuver ke laut dalam (>200m).',
        coords: [-5.93, 105.99],
        icon: '🚢',
      },
      {
        facility: 'PLTU Suralaya & Labuan',
        type: 'Pembangkit Tenaga Listrik',
        location: 'Cilegon & Pandeglang, Banten',
        damage_level: 'MODERATE',
        loss_estimate: 'Saluran intake pendingin air laut terancam puing sedimentasi',
        operational_status: 'ISOLASI DARURAT (SAFE SHUTDOWN)',
        critical_action: 'Alihkan pasokan energi listrik ke sistem interkoneksi cadangan Jawa-Bali.',
        coords: [-5.89, 106.03],
        icon: '⚡',
      },
      {
        facility: 'Jalan Raya Lintas Pesisir Anyer - Labuan',
        type: 'Akses Utama Jalur Pantai',
        location: 'Banten Barat',
        damage_level: mag >= 7.5 ? 'HEAVY' : 'MODERATE',
        loss_estimate: 'Genangan air laut & material puing menutup sebagian badan jalan',
        operational_status: 'HANYA KENDARAAN DARURAT TINGGI',
        critical_action: 'Arahkan kendaraan evakuasi melewati rute pedalaman Mandalawangi.',
        coords: [-6.15, 105.86],
        icon: '🛣️',
      },
      {
        facility: 'BTS Telekomunikasi Selat Sunda & Kalianda',
        type: 'Menara Komunikasi Pesisir',
        location: 'Banten Barat & Lampung Selatan',
        damage_level: 'MODERATE',
        loss_estimate: '34 BTS pesisir padam listrik dan beralih ke baterai darurat',
        operational_status: 'DEGRADASI LAYANAN (45%)',
        critical_action: 'Aktivasi transmisi radio satelit BNPB & kanal VHF maritim darurat.',
        coords: [-5.73, 105.59],
        icon: '📡',
      },
    ];
  } else if (isSumatraWest) {
    affectedZones = [
      'Kepulauan Mentawai (Siberut, Sipora, Pagai)',
      'Pesisir Kota Padang & Teluk Bayur (Sumatera Barat)',
      'Pesisir Nias & Nias Selatan (Sumatera Utara)',
      'Pesisir Bengkulu & Mukomuko',
      'Pesisir Krui / Pesisir Barat Lampung',
    ];
    zoneDetails = [
      {
        zone: 'Kepulauan Mentawai (Siberut & Sipora)',
        province: 'Sumatera Barat',
        estimated_eta: '10 - 18 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 1.1).toFixed(1)} - ${(waveEstimatedMax * 1.4).toFixed(1)} Meter`,
        status: 'AWAS',
        inundation_depth: 'Hingga 800m ke daratan',
        population_at_risk: '38.000 Jiwa',
        safe_elevation: '> 30 Meter dpl',
        coords: [-1.85, 99.10],
        polygon: [
          [-1.30, 98.70],
          [-1.30, 99.40],
          [-2.40, 99.80],
          [-2.40, 99.10],
        ],
      },
      {
        zone: 'Pesisir Kota Padang & Bungus',
        province: 'Sumatera Barat',
        estimated_eta: '25 - 35 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.8).toFixed(1)} - ${(waveEstimatedMax * 1.0).toFixed(1)} Meter`,
        status: 'AWAS',
        inundation_depth: 'Hingga 500m ke daratan perkotaan',
        population_at_risk: '120.000 Jiwa',
        safe_elevation: '> 25 Meter dpl',
        coords: [-0.95, 100.35],
        polygon: [
          [-0.85, 100.30],
          [-0.85, 100.42],
          [-1.05, 100.45],
          [-1.05, 100.32],
        ],
      },
      {
        zone: 'Pesisir Nias & Nias Selatan',
        province: 'Sumatera Utara',
        estimated_eta: '22 - 32 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.7).toFixed(1)} - ${(waveEstimatedMax * 0.9).toFixed(1)} Meter`,
        status: 'SIAGA',
        inundation_depth: 'Hingga 350m ke daratan',
        population_at_risk: '55.000 Jiwa',
        safe_elevation: '> 20 Meter dpl',
        coords: [1.10, 97.60],
        polygon: [
          [0.60, 97.40],
          [0.60, 97.90],
          [1.50, 97.90],
          [1.50, 97.30],
        ],
      },
    ];
    infraDetails = [
      {
        facility: 'Pelabuhan Teluk Bayur Padang',
        type: 'Pelabuhan Kargo & Logistik Barat',
        location: 'Kota Padang, Sumbar',
        damage_level: 'HEAVY',
        loss_estimate: 'Dermaga kontainer terendam banjir laut, crane pelabuhan non-aktif',
        operational_status: 'EVAKUASI ZONA PELABUHAN',
        critical_action: 'Kapal lepas tali sandar dan segera berlayar ke laut lepas Mentawai.',
        coords: [-0.99, 100.37],
        icon: '🚢',
      },
      {
        facility: 'Jembatan & Jalan Samudera Pantai Padang',
        type: 'Infrastruktur Transportasi Pesisir',
        location: 'Padang Barat',
        damage_level: 'HEAVY',
        loss_estimate: 'Tergerus abrasi gelombang dan tertutup genangan air laut',
        operational_status: 'DITUTUP TOTAL',
        critical_action: 'Gunakan Jalur Evakuasi Tsunami (Jalur By-Pass Padang Timur).',
        coords: [-0.93, 100.35],
        icon: '🛣️',
      },
      {
        facility: 'Bandara Internasional Minangkabau (BIM) Hub Shelter',
        type: 'Fasilitas Penerbangan & Evakuasi',
        location: 'Ketaping, Padang Pariaman',
        damage_level: 'LIGHT',
        loss_estimate: 'Ketinggian aman dari tsunami primer, siaga lonjakan pengungsi',
        operational_status: 'SIAGA LOGISTIK DARURAT',
        critical_action: 'Buka apron dan terminal darurat untuk pendaratan armada Hercules TNI-AU.',
        coords: [-0.78, 100.28],
        icon: '✈️',
      },
    ];
  } else if (isJavaSouth) {
    affectedZones = [
      'Pesisir Cilacap & Teluk Penyu (Jawa Tengah)',
      'Pesisir Pangandaran (Jawa Barat)',
      'Pesisir Pacitan & Kulonprogo (DIY / Jatim)',
      'Pesisir Kebumen & Purworejo',
    ];
    zoneDetails = [
      {
        zone: 'Pesisir Cilacap & Teluk Penyu',
        province: 'Jawa Tengah',
        estimated_eta: '20 - 32 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.8).toFixed(1)} - ${(waveEstimatedMax * 1.1).toFixed(1)} Meter`,
        status: mag >= 7.5 ? 'AWAS' : 'SIAGA',
        inundation_depth: 'Hingga 600m dataran landai',
        population_at_risk: '85.000 Jiwa',
        safe_elevation: '> 20 Meter dpl',
        coords: [-7.72, 109.02],
        polygon: [
          [-7.65, 108.90],
          [-7.65, 109.15],
          [-7.80, 109.15],
          [-7.80, 108.90],
        ],
      },
      {
        zone: 'Kawasan Wisata Pantai Pangandaran',
        province: 'Jawa Barat',
        estimated_eta: '22 - 35 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.75).toFixed(1)} - ${(waveEstimatedMax * 1.0).toFixed(1)} Meter`,
        status: 'SIAGA',
        inundation_depth: 'Hingga 450m ke daratan',
        population_at_risk: '42.000 Jiwa',
        safe_elevation: '> 20 Meter dpl',
        coords: [-7.70, 108.65],
        polygon: [
          [-7.66, 108.60],
          [-7.66, 108.72],
          [-7.75, 108.72],
          [-7.75, 108.60],
        ],
      },
    ];
    infraDetails = [
      {
        facility: 'Kilang Minyak Pertamina RU IV Cilacap',
        type: 'Objek Vital Energi Nasional',
        location: 'Cilacap Pesisir, Jawa Tengah',
        damage_level: 'MODERATE',
        loss_estimate: 'Tanggul pembatas laut terkena hempasan air pasang tinggi',
        operational_status: 'STATUS SIAGA 1 (EMERGENCY PROTOCOL)',
        critical_action: 'Aktivasi penutupan katup pipa laut & evakuasi personel ke shelter aman.',
        coords: [-7.70, 109.01],
        icon: '⚡',
      },
      {
        facility: 'Bandara Internasional Yogyakarta (YIA) Kulon Progo',
        type: 'Bandara Internasional Pesisir',
        location: 'Kulon Progo, DIY',
        damage_level: 'LIGHT',
        loss_estimate: 'Runway barat dekat tanggul pantai waspada hempasan air laut',
        operational_status: 'PEMERIKSAAN RUNWAY & TANGGUL',
        critical_action: 'Fasilitas memiliki seawall tsunami; evakuasi lantai 2 & 3 terminal.',
        coords: [-7.90, 110.05],
        icon: '✈️',
      },
    ];
  } else if (isSulawesiMaluku) {
    affectedZones = [
      'Pesisir Teluk Palu & Donggala (Sulawesi Tengah)',
      'Pesisir Bitung & Minahasa Utara (Sulawesi Utara)',
      'Pesisir Ternate & Halmahera Barat (Maluku Utara)',
      'Pesisir Teluk Ambon (Maluku)',
    ];
    zoneDetails = [
      {
        zone: 'Pesisir Donggala & Teluk Palu',
        province: 'Sulawesi Tengah',
        estimated_eta: '6 - 15 Menit (Tsunami Cepat / Longsoran Bawah Laut)',
        estimated_wave_height: `${(waveEstimatedMax * 0.9).toFixed(1)} - ${(waveEstimatedMax * 1.3).toFixed(1)} Meter`,
        status: 'AWAS',
        inundation_depth: 'Hingga 350m di teluk sempit',
        population_at_risk: '52.000 Jiwa',
        safe_elevation: '> 25 Meter dpl',
        coords: [-0.85, 119.85],
        polygon: [
          [-0.75, 119.78],
          [-0.75, 119.92],
          [-0.95, 119.92],
          [-0.95, 119.78],
        ],
      },
      {
        zone: 'Pesisir Bitung & Pulau Lembeh',
        province: 'Sulawesi Utara',
        estimated_eta: '18 - 28 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.7).toFixed(1)} - ${(waveEstimatedMax * 0.95).toFixed(1)} Meter`,
        status: 'SIAGA',
        inundation_depth: 'Hingga 250m ke daratan',
        population_at_risk: '36.000 Jiwa',
        safe_elevation: '> 18 Meter dpl',
        coords: [1.44, 125.18],
        polygon: [
          [1.38, 125.10],
          [1.38, 125.26],
          [1.50, 125.26],
          [1.50, 125.10],
        ],
      },
    ];
    infraDetails = [
      {
        facility: 'Pelabuhan Samudera Pantoloan / Palu',
        type: 'Pelabuhan Hub Wilayah',
        location: 'Teluk Palu, Sulteng',
        damage_level: 'HEAVY',
        loss_estimate: 'Gantry crane & dermaga rentan hempasan gelombang teluk sempit',
        operational_status: 'EVAKUASI SEGERA',
        critical_action: 'Hentikan aktivitas bongkar muat dan naik ke bukit Pantoloan.',
        coords: [-0.72, 119.86],
        icon: '🚢',
      },
      {
        facility: 'Jembatan & Akses Jalan Trans-Sulawesi Pesisir',
        type: 'Akses Transportasi Utama',
        location: 'Donggala - Palu Barat',
        damage_level: 'HEAVY',
        loss_estimate: 'Terputus akibat longsoran lereng dan luapan air teluk',
        operational_status: 'DITUTUP TOTAL',
        critical_action: 'Gunakan jalur perbukitan Kawatuna & Palu Timur.',
        coords: [-0.88, 119.83],
        icon: '🛣️',
      },
    ];
  } else {
    // Generic coastal region fallback based on real earthquake coordinates
    affectedZones = [
      `Pesisir Pantai Dekat Episenter: ${wilayah}`,
      'Pulau-pulau dan teluk dalam radius 120 km',
      'Kawasan pelabuhan nelayan & permukiman pesisir terdekat',
    ];
    zoneDetails = [
      {
        zone: `Pesisir Dekat Episenter: ${wilayah}`,
        province: 'Indonesia',
        estimated_eta: '15 - 30 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.7).toFixed(1)} - ${waveEstimatedMax.toFixed(1)} Meter`,
        status: mag >= 7.5 ? 'AWAS' : 'SIAGA',
        inundation_depth: 'Hingga 350m garis pantai',
        population_at_risk: 'Kawasan Pesisir Sekitar',
        safe_elevation: '> 20 Meter dpl',
        coords: [lat + 0.12, lon + 0.12],
        polygon: [
          [lat + 0.05, lon + 0.05],
          [lat + 0.05, lon + 0.25],
          [lat + 0.25, lon + 0.25],
          [lat + 0.25, lon + 0.05],
        ],
      },
      {
        zone: `Teluk & Pulau Sekitar: ${wilayah}`,
        province: 'Indonesia',
        estimated_eta: '25 - 45 Menit Pasca Gempa',
        estimated_wave_height: `${(waveEstimatedMax * 0.45).toFixed(1)} - ${(waveEstimatedMax * 0.7).toFixed(1)} Meter`,
        status: 'WASPADA',
        inundation_depth: 'Hingga 180m garis pantai',
        population_at_risk: 'Permukiman Pulau Terdekat',
        safe_elevation: '> 15 Meter dpl',
        coords: [lat - 0.15, lon - 0.15],
      },
    ];
    infraDetails = [
      {
        facility: `Dermaga & Pelabuhan Pesisir ${wilayah}`,
        type: 'Infrastruktur Pelabuhan Lokal',
        location: wilayah,
        damage_level: mag >= 7.5 ? 'HEAVY' : 'MODERATE',
        loss_estimate: 'Potensi limpasan gelombang pasang merendam dermaga tambat kapal',
        operational_status: 'WASPADA DARURAT (SUSPENDED)',
        critical_action: 'Instruksikan kapal nelayan bermanuver ke laut dalam dan evakuasi ABK.',
        coords: [lat + 0.08, lon + 0.08],
        icon: '🚢',
      },
      {
        facility: `Akses Jalan Pesisir & Jembatan Penghubung ${wilayah}`,
        type: 'Jalur Evakuasi Darat',
        location: wilayah,
        damage_level: 'MODERATE',
        loss_estimate: 'Risiko genangan air laut dan material endapan pasir di badan jalan',
        operational_status: 'DIBATASI HANYA KENDARAAN DARURAT',
        critical_action: 'Arahkan warga menggunakan rute evakuasi menuju perbukitan pedalaman.',
        coords: [lat + 0.14, lon + 0.06],
        icon: '🛣️',
      },
      {
        facility: `Menara Telekomunikasi & Jaringan Listrik Pesisir`,
        type: 'Infrastruktur Utilitas Vital',
        location: wilayah,
        damage_level: 'LIGHT',
        loss_estimate: 'Potensi pemadaman listrik gardu distribusi pesisir',
        operational_status: 'SIAGA GENSET CADANGAN',
        critical_action: 'Siapkan link radio satelit darurat BNPB/BPBD untuk posko komando.',
        coords: [lat + 0.05, lon + 0.16],
        icon: '📡',
      },
    ];
  }

  return {
    active: true,
    detection_time: latestQuake.Jam || new Date().toLocaleTimeString('id-ID'),
    sensor_id: `InaTEWS BMKG Telemetry (Episenter: ${latestQuake.Wilayah})`,
    wave_anomaly: parseFloat(waveEstimatedMax.toFixed(2)),
    affected_zones: affectedZones,
    affected_zone_details: zoneDetails,
    infrastructure_impacts: infraDetails,
    response_actions: [
      'Evakuasi segera seluruh warga pesisir ke tempat evakuasi sementara (TES) atau bukit >20 meter',
      'Pemerintah Daerah mengaktifkan sirine peringatan dini tsunami InaTEWS & woro-woro pesisir',
      'Otoritas Pelabuhan dan Syahbandar menunda seluruh izin keberangkatan kapal laut',
      'Posko SAR, BNPB, dan BPBD setempat siaga penuh di pos koordinasi bencana',
    ],
    severity: mag >= 7.5 ? 'CRITICAL (AWAS)' : 'HIGH (SIAGA)',
    timestamp: latestQuake.DateTime || new Date().toISOString(),
  };
}
