import App from '@/app';
import AuthRoute from '@/routes/auth';
import IndexRoute from '@/routes/index.routes';
import MonitoringRoute from '@/routes/monitoring.routes';

import AdminRoute from '@/routes/admin';

import AppUsersRoute from '@/routes/user/app.index';
import AdminUsersRoute from '@/routes/user/admin.index';

import MiscRoute from '@routes/misc/index';
import EnquiryRoute from './routes/enquiry/enquiry';
import { validateEnvironment } from '@utils/validateEnv';
import AgentRoute from './routes/admin/agent.index';
import AgentTransactionRoute from './routes/transaction/agent.transaction';
import AgentMarketRoute from './routes/market/agent.index';
import AgentBetRoute from './routes/bet/agent.index';

import MatchRoute from './routes/match/index';
import MatchBetRoute from './routes/matchBet/index';
import AdminAnnouncementRoute from './routes/announcement';
import SettlementRoute from './routes/settlement';



validateEnvironment();

const app = new App([new IndexRoute(), new MonitoringRoute(), new AppUsersRoute(), new AdminUsersRoute(), new AuthRoute(), new AdminRoute(), new MiscRoute(), new EnquiryRoute(), new AgentRoute(), new AgentTransactionRoute(),
new AgentMarketRoute(), new AgentBetRoute(), new MatchRoute(), new MatchBetRoute(), new AdminAnnouncementRoute(), new SettlementRoute()]);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  app.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  app.shutdown();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.shutdown();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  app.shutdown();
  process.exit(1);
});

app.listen();
