// src/utils/socket.js
import { io } from 'socket.io-client';

const socket = io(process.env.NODE_ENV === 'development'
    ? 'http://localhost:5001'  // For local development
    : 'my-node-app-env.eba-fmxdv3xt.us-east-1.elasticbeanstalk.com',  // For production (Elastic Beanstalk)
  {
    withCredentials: true,
  });
  
export default socket;
