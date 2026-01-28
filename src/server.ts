import App from '@/app';
import AuthRoute from '@/routes/auth';
import IndexRoute from '@/routes/index.routes';
import MonitoringRoute from '@/routes/monitoring.routes';

import AdminRoute from '@/routes/admin';

import AppBetRoute from './routes/bet/app.index';
import AdminBetRoute from './routes/bet/admin.index';

import AppMarketRoute from './routes/market/app.index';
import AdminMarketRoute from './routes/market/admin.index';

import AppTransactionRoute from './routes/transaction/app.transaction';
import AdminTransactionRoute from './routes/transaction/admin.transaction';

import AppUsersRoute from '@/routes/user/app.index';
import AdminUsersRoute from '@/routes/user/admin.index';

import AdminSettingRoute from '@/routes/setting/admin.setting';
import AppSettingRoute from '@/routes/setting/app.setting';

import AdminSliderRoute from './routes/slider/admin.slider';
import AppSliderRoute from './routes/slider/app.slider';

import AdminNotificationRoute from './routes/notification/admin.index';
import AppNotificationRoute from './routes/notification/app.index';

import AdminNoticeRoute from './routes/notice/admin.index';
import AppNoticeRoute from './routes/notice/app.index';

import MiscRoute from '@routes/misc/index';
import PublicRoute from './routes/public/public';
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

const app = new App([new IndexRoute(), new MonitoringRoute(), new AppUsersRoute(), new AdminUsersRoute(), new AuthRoute(), new AdminRoute(), new AdminMarketRoute(),
new AppMarketRoute(), new AppBetRoute(), new AdminBetRoute(), new AppTransactionRoute(), new AdminTransactionRoute(), new AdminSettingRoute(),
new AppSettingRoute(), new MiscRoute(), new AdminSliderRoute(), new AppSliderRoute(), new AdminNotificationRoute(), new AppNotificationRoute(),
new AdminNoticeRoute(), new AppNoticeRoute(), new PublicRoute(), new EnquiryRoute(), new AgentRoute(), new AgentTransactionRoute(),
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
