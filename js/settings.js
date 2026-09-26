// settings.js — graphics quality presets and user-adjustable options

export const QUALITY_PRESETS = {
  low: {
    pixelRatioCap: 1,
    shadowMapSize: 512,
    shadowsEnabled: false,
    drawDistance: 220,
    fog: 180,
  },
  medium: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    drawDistance: 350,
    fog: 280,
  },
  high: {
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    drawDistance: 500,
    fog: 400,
  },
};

class Settings {
  constructor() {
    this.quality = 'medium';
    this.sensitivity = 1.4;
  }

  get preset() {
    return QUALITY_PRESETS[this.quality];
  }

  setQuality(name) {
    if (QUALITY_PRESETS[name]) this.quality = name;
  }

  setSensitivity(value) {
    this.sensitivity = Number(value) || 1.4;
  }

  toJSON() {
    return { quality: this.quality, sensitivity: this.sensitivity };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.quality) this.quality = data.quality;
    if (data.sensitivity) this.sensitivity = data.sensitivity;
  }
}

export const settings = new Settings();
