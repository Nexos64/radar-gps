export interface Radar {
	id: string;
	lat: number;
	lng: number;
	type: RadarType;
	speedLimit: number | null;
	angle: number | null;       // azimut en degrés (0=nord)
	bidirectional: boolean;
	source: 'luftop' | 'osm' | 'waze';
}

export type RadarType = 'fixed' | 'mobile' | 'traffic_light' | 'section_start' | 'section_end' | 'police' | 'other';
