export interface VolcanoLocation {
  name: string;
  aliases: string[];
  pos: [number, number]; // [lat, lon]
  elevation: number; // meters above sea level
  island: string;
  province: string;
  pgaStation: string;
  sensorType: string;
  defaultLevel: string;
}

export const INDONESIAN_VOLCANOES: VolcanoLocation[] = [
  {
    name: 'Anak Krakatau',
    aliases: ['krakatau', 'anak krakatau', 'g. anak krakatau'],
    pos: [-6.102, 105.423],
    elevation: 157,
    island: 'Selat Sunda',
    province: 'Lampung / Banten',
    pgaStation: 'Pos PGA Pasauran, Anyer',
    sensorType: 'Short-Period Mark L4C + Broadband Güralp CMG-40T',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Ibu',
    aliases: ['ibu', 'g. ibu'],
    pos: [1.488, 127.630],
    elevation: 1325,
    island: 'Halmahera Barat',
    province: 'Maluku Utara',
    pgaStation: 'Pos PGA Gam Ici, Ibu',
    sensorType: 'Lennartz 3D 1-Hz + Kinemetrics Basalt 24-bit',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Lewotobi Laki-laki',
    aliases: ['lewotobi laki-laki', 'lewotobi', 'g. lewotobi laki-laki', 'lewotobi perempuan'],
    pos: [-8.538, 122.768],
    elevation: 1584,
    island: 'Flores Timur',
    province: 'Nusa Tenggara Timur',
    pgaStation: 'Pos PGA Pululera, Wulanggitang',
    sensorType: 'Broadband Güralp CMG-6TD (100 Hz)',
    defaultLevel: 'LEVEL IV (AWAS)',
  },
  {
    name: 'Ili Lewotolok',
    aliases: ['ili lewotolok', 'lewotolok', 'g. ili lewotolok'],
    pos: [-8.272, 123.505],
    elevation: 1423,
    island: 'Lembata',
    province: 'Nusa Tenggara Timur',
    pgaStation: 'Pos PGA Lamahora, Ile Ape',
    sensorType: 'Short-Period Mark L4C + Digitizer 24-bit',
    defaultLevel: 'LEVEL II (WASPADA)',
  },
  {
    name: 'Semeru',
    aliases: ['semeru', 'g. semeru', 'mahameru'],
    pos: [-8.108, 112.922],
    elevation: 3676,
    island: 'Jawa Timur',
    province: 'Lumajang / Malang',
    pgaStation: 'Pos PGA Gunung Sawur, Candipuro',
    sensorType: 'Broadband Güralp CMG-40T + Telemetri RTS',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Merapi',
    aliases: ['merapi', 'g. merapi'],
    pos: [-7.540, 110.446],
    elevation: 2968,
    island: 'Jawa Tengah / DIY',
    province: 'Sleman / Klaten / Boyolali / Magelang',
    pgaStation: 'Pos PGA Kaliurang & Babadan (BPPTKG)',
    sensorType: 'Broadband Nanometrics Trillium Compact 120s',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Marapi',
    aliases: ['marapi', 'g. marapi'],
    pos: [-0.381, 100.473],
    elevation: 2891,
    island: 'Sumatera Barat',
    province: 'Agam / Tanah Datar',
    pgaStation: 'Pos PGA Batu Palano, Sungai Pua',
    sensorType: 'Short-Period Mark L4C + Broadband Seismometer',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Sinabung',
    aliases: ['sinabung', 'g. sinabung'],
    pos: [3.170, 98.392],
    elevation: 2460,
    island: 'Sumatera Utara',
    province: 'Karo',
    pgaStation: 'Pos PGA Ndokum Siroga, Simpang Empat',
    sensorType: 'Broadband Güralp CMG-40T + Seismic Array',
    defaultLevel: 'LEVEL II (WASPADA)',
  },
  {
    name: 'Ruang',
    aliases: ['ruang', 'g. ruang'],
    pos: [2.300, 125.370],
    elevation: 725,
    island: 'Kepulauan Sitaro',
    province: 'Sulawesi Utara',
    pgaStation: 'Pos PGA Tagulandang',
    sensorType: 'Broadband Seismometer + Buoy Warning Interface',
    defaultLevel: 'LEVEL III (SIAGA)',
  },
  {
    name: 'Dukono',
    aliases: ['dukono', 'g. dukono'],
    pos: [1.680, 127.880],
    elevation: 1335,
    island: 'Halmahera Utara',
    province: 'Maluku Utara',
    pgaStation: 'Pos PGA Mamuya, Tobelo',
    sensorType: 'Short-Period Mark L4C + Real-Time Telemetry',
    defaultLevel: 'LEVEL II (WASPADA)',
  },
  {
    name: 'Bromo',
    aliases: ['bromo', 'g. bromo'],
    pos: [-7.942, 112.950],
    elevation: 2329,
    island: 'Jawa Timur',
    province: 'Probolinggo / Pasuruan',
    pgaStation: 'Pos PGA Ngadisari, Sukapura',
    sensorType: 'Broadband Güralp CMG-40T',
    defaultLevel: 'LEVEL II (WASPADA)',
  },
  {
    name: 'Tangkuban Parahu',
    aliases: ['tangkuban parahu', 'tangkuban perahu', 'g. tangkuban parahu'],
    pos: [-6.770, 107.600],
    elevation: 2084,
    island: 'Jawa Barat',
    province: 'Subang / Bandung Barat',
    pgaStation: 'Pos PGA Cikole, Lembang',
    sensorType: 'Short-Period Mark L4C + Geophone Array',
    defaultLevel: 'LEVEL I (NORMAL)',
  },
  {
    name: 'Kelud',
    aliases: ['kelud', 'g. kelud'],
    pos: [-7.930, 112.308],
    elevation: 1731,
    island: 'Jawa Timur',
    province: 'Kediri / Blitar',
    pgaStation: 'Pos PGA Sugihwaras, Ngancar',
    sensorType: 'Broadband Trillium Compact',
    defaultLevel: 'LEVEL I (NORMAL)',
  },
  {
    name: 'Kerinci',
    aliases: ['kerinci', 'g. kerinci'],
    pos: [-1.697, 101.264],
    elevation: 3805,
    island: 'Sumatera Tengah',
    province: 'Jambi / Sumatera Barat',
    pgaStation: 'Pos PGA Kayu Aro, Kerinci',
    sensorType: 'Short-Period Mark L4C',
    defaultLevel: 'LEVEL II (WASPADA)',
  },
  {
    name: 'Agung',
    aliases: ['agung', 'g. agung'],
    pos: [-8.343, 115.508],
    elevation: 3142,
    island: 'Bali',
    province: 'Karangasem',
    pgaStation: 'Pos PGA Rendang, Karangasem',
    sensorType: 'Broadband Güralp CMG-40T',
    defaultLevel: 'LEVEL I (NORMAL)',
  },
];

export function findVolcanoLocation(name: string): VolcanoLocation | null {
  if (!name) return null;
  const clean = name.toLowerCase().trim().replace(/^g\.\s*/, '');
  for (const v of INDONESIAN_VOLCANOES) {
    if (v.name.toLowerCase() === clean) return v;
    for (const alias of v.aliases) {
      if (clean.includes(alias) || alias.includes(clean)) {
        return v;
      }
    }
  }
  return null;
}

export interface VolcanicAshTrajectory {
  volcanoName: string;
  windDirectionDeg: number; // Wind blowing towards this azimuth (0° North, 90° East, 180° South, 270° West)
  windDirectionCardinal: string; // e.g. "Barat Daya (SW)"
  windSpeedKts: number; // knots
  plumeHeightMeters: number; // meters above crater
  plumeColor: string;
  vonaColorCode: 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN';
  affectedAviationRoute: string;
  hazardRadiusKm: number;
  sectorNotice: string;
  coneSpreadDeg: number; // Dispersion fan spread angle
  eruptionDurationEst: string; // Durasi semburan letusan / tremor
  ashDispersionDurationEst: string; // Estimasi durasi partikel abu melayang di troposfer
  totalHazardWindow: string; // Waktu jendela mitigasi siaga
}

export const VOLCANIC_ASH_TRAJECTORIES: Record<string, VolcanicAshTrajectory> = {
  'Anak Krakatau': {
    volcanoName: 'Anak Krakatau',
    windDirectionDeg: 240,
    windDirectionCardinal: 'Barat Daya (SW)',
    windSpeedKts: 22,
    plumeHeightMeters: 3500,
    plumeColor: 'Kelabu pekat hingga hitam intensitas tebal',
    vonaColorCode: 'RED',
    affectedAviationRoute: 'ATS Route W-12 / Selat Sunda / FIR Jakarta',
    hazardRadiusKm: 35,
    sectorNotice: 'Sektor Barat Daya - Barat: Pulau Sebesi, Kalianda, dan alur perkapalan Selat Sunda',
    coneSpreadDeg: 45,
    eruptionDurationEst: '±50 - 90 detik (Tremor Letusan Kuat)',
    ashDispersionDurationEst: '±4 - 6 jam (Partikel Melayang ke Selat Sunda)',
    totalHazardWindow: 'Hingga 8 jam pasca-erupsi',
  },
  'Ibu': {
    volcanoName: 'Ibu',
    windDirectionDeg: 25,
    windDirectionCardinal: 'Timur Laut - Utara (NNE)',
    windSpeedKts: 18,
    plumeHeightMeters: 2800,
    plumeColor: 'Kelabu tebal condong ke arah utara',
    vonaColorCode: 'ORANGE',
    affectedAviationRoute: 'Koridor Udara Halmahera Utara / Bandara Kuabang Kao',
    hazardRadiusKm: 25,
    sectorNotice: 'Kecamatan Ibu dan pesisir utara Halmahera Barat',
    coneSpreadDeg: 40,
    eruptionDurationEst: '±40 - 75 detik (Letusan Berkala & Piroklastik)',
    ashDispersionDurationEst: '±3 - 5 jam (Partikel Melayang Sektor Utara)',
    totalHazardWindow: 'Hingga 6 jam pasca-erupsi',
  },
  'Lewotobi Laki-laki': {
    volcanoName: 'Lewotobi Laki-laki',
    windDirectionDeg: 285,
    windDirectionCardinal: 'Barat - Barat Laut (WNW)',
    windSpeedKts: 26,
    plumeHeightMeters: 4500,
    plumeColor: 'Abu vulkanik pekat kecokelatan membubung tinggi',
    vonaColorCode: 'RED',
    affectedAviationRoute: 'Koridor Udara Flores / Bandara Frans Seda Maumere',
    hazardRadiusKm: 45,
    sectorNotice: 'Sektor Barat-Barat Laut: Desa Dulipali, Klatanlo, Hokeng Jaya, hingga Maumere',
    coneSpreadDeg: 50,
    eruptionDurationEst: '±120 - 180 detik (Erupsi Eksplosif Paroksismal)',
    ashDispersionDurationEst: '±6 - 10 jam (Sebaran Abu Tebal Meluas)',
    totalHazardWindow: 'Hingga 12 jam pasca-erupsi paroksismal',
  },
  'Ili Lewotolok': {
    volcanoName: 'Ili Lewotolok',
    windDirectionDeg: 140,
    windDirectionCardinal: 'Tenggara - Selatan (SE)',
    windSpeedKts: 16,
    plumeHeightMeters: 2000,
    plumeColor: 'Putih kelabu intensitas sedang hingga tebal',
    vonaColorCode: 'ORANGE',
    affectedAviationRoute: 'Airspace Lembata / Laut Sawu',
    hazardRadiusKm: 20,
    sectorNotice: 'Sektor Tenggara dan lereng selatan Ile Ape',
    coneSpreadDeg: 35,
    eruptionDurationEst: '±35 - 60 detik (Hembusan Eksplosif Dangkal)',
    ashDispersionDurationEst: '±2 - 4 jam (Sebaran Abu Halus Sektor Tenggara)',
    totalHazardWindow: 'Hingga 5 jam pasca-hembusan',
  },
  'Semeru': {
    volcanoName: 'Semeru',
    windDirectionDeg: 215,
    windDirectionCardinal: 'Selatan - Barat Daya (SSW)',
    windSpeedKts: 24,
    plumeHeightMeters: 4000,
    plumeColor: 'Asap letusan kelabu gelap membawa material piroklastik',
    vonaColorCode: 'RED',
    affectedAviationRoute: 'ATS Route B-470 / Koridor Selatan Jawa',
    hazardRadiusKm: 40,
    sectorNotice: 'Besuk Kobokan, Curah Kobokan, Pronojiwo, dan Samudera Hindia',
    coneSpreadDeg: 45,
    eruptionDurationEst: '±90 - 140 detik (Awan Panas Guguran & Letusan)',
    ashDispersionDurationEst: '±5 - 8 jam (Sebaran Abu Melayang Sektor Selatan)',
    totalHazardWindow: 'Hingga 10 jam pasca-guguran awan panas',
  },
  'Merapi': {
    volcanoName: 'Merapi',
    windDirectionDeg: 240,
    windDirectionCardinal: 'Barat Daya (SW)',
    windSpeedKts: 20,
    plumeHeightMeters: 2500,
    plumeColor: 'Asap kawah kelabu putih tebal dan guguran lava',
    vonaColorCode: 'ORANGE',
    affectedAviationRoute: 'FIR Yogyakarta / Koridor W-45',
    hazardRadiusKm: 25,
    sectorNotice: 'Sektor Barat Daya hulu Kali Bebeng, Kali Krasak, Magelang',
    coneSpreadDeg: 40,
    eruptionDurationEst: '±60 - 110 detik (Guguran Lava Pijar & Letusan)',
    ashDispersionDurationEst: '±3 - 6 jam (Sebaran Abu ke Lereng Barat Daya)',
    totalHazardWindow: 'Hingga 6 jam pasca-erupsi',
  },
};

export function getVolcanicAshTrajectory(volcanoName: string): VolcanicAshTrajectory {
  if (!volcanoName) return VOLCANIC_ASH_TRAJECTORIES['Anak Krakatau'];
  const clean = volcanoName.toLowerCase().trim().replace(/^g\.\s*/, '');
  for (const key of Object.keys(VOLCANIC_ASH_TRAJECTORIES)) {
    if (key.toLowerCase().includes(clean) || clean.includes(key.toLowerCase())) {
      return VOLCANIC_ASH_TRAJECTORIES[key];
    }
  }
  // Default dynamic estimate
  return {
    volcanoName,
    windDirectionDeg: 240,
    windDirectionCardinal: 'Barat Daya (SW)',
    windSpeedKts: 20,
    plumeHeightMeters: 3000,
    plumeColor: 'Kelabu sedang hingga pekat',
    vonaColorCode: 'ORANGE',
    affectedAviationRoute: 'ATS Regional Airway',
    hazardRadiusKm: 30,
    sectorNotice: `Sektor Barat Daya radius 30 km dari kawah ${volcanoName}`,
    coneSpreadDeg: 45,
    eruptionDurationEst: '±45 - 90 detik (Fase Letusan Utama)',
    ashDispersionDurationEst: '±4 - 6 jam (Waktu Melayang Partikel di Udara)',
    totalHazardWindow: 'Hingga 6 - 8 jam pasca-erupsi',
  };
}

