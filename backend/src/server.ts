import app from './app.js';
import { connectDB } from './config/db.js';
import { ensureSeeded } from './seed.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await ensureSeeded();

    const server = app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`Urban Furniture Accounting Backend API`);
      console.log(`Server running on port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Healthcheck: http://localhost:${PORT}/api/health`);
      console.log(`=============================================`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = () => {
      console.log('\n[Server] Received kill signal, shutting down gracefully...');
      server.close(() => {
        console.log('[Server] Closed remaining connections.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('[Server] Fatal error during startup:', error);
    process.exit(1);
  }
};

startServer();
