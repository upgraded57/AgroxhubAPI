import multer from "multer";

export const DISTANCE_COST_PER_KM = 120;
export const DEFAULT_LOCAL_RADIUS_KM = 1.5; // default average in metres
export const CALIBRATED_DISTANCE_DIFFERENCE_IN_KM = 1.15;

const storage = multer.memoryStorage();
export const upload = multer({ storage });
