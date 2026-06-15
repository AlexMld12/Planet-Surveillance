export interface WindyLocation {
  city: string;
  region: string;
  region_code?: string;
  country: string;
  country_code?: string;
  continent: string;
  latitude: number;
  longitude: number;
}

export interface WindyImageSet {
  current: { icon: string; thumbnail: string; preview: string };
}

export interface WindyPlayer {
  live?: string;
  day?: string;
  month?: string;
  year?: string;
  lifetime?: string;
}

export interface Webcam {
  webcamId: number;
  title: string;
  status: string;
  viewCount: number;
  location: WindyLocation;
  images?: WindyImageSet;
  player?: WindyPlayer;
}

export interface WebcamsResponse {
  total: number;
  webcams: Webcam[];
}
