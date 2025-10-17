
const isDevelopment = import.meta.env.DEV;

export const API_ENDPOINTS = {
  // Express Server (AI Assistant)
  EXPRESS_API: isDevelopment 
    ? 'http://localhost:3000'
    : 'https://dronex-copy.onrender.com',
  
  // FastAPI Rekognition Backend
  REKOGNITION_API: isDevelopment
    ? 'http://localhost:8001/api/rekognition/detect'
    : 'https://disastermanagementrekognition.onrender.com/api/rekognition/detect',
  
  // MediaSoup Server (WebRTC)
  MEDIASOUP_SERVER: isDevelopment
    ? 'http://localhost:3002'
    : 'https://mediasoupserver.onrender.com',
};
