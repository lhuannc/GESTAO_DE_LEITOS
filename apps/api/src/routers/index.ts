import { router } from '../trpc';
import { leitosRouter } from './leitos';
import { authRouter } from './auth';
import { ordersRouter } from './orders';
import { servicesRouter } from './services';
import { usersRouter } from './users';
import { teamsRouter } from './teams';
import { companiesRouter } from './companies';
import { unitsRouter } from './units';
import { sectorsRouter } from './sectors';
import { sectionsRouter } from './sections';
import { stepsRouter } from './steps';
import { configRouter } from './config';
import { complementItemsRouter } from './complementItems';

/**
 * Main application router
 * Combines all sub-routers
 */
export const appRouter = router({
  auth: authRouter,
  leitos: leitosRouter,
  orders: ordersRouter,
  services: servicesRouter,
  users: usersRouter,
  teams: teamsRouter,
  companies: companiesRouter,
  units: unitsRouter,
  sectors: sectorsRouter,
  sections: sectionsRouter,
  steps: stepsRouter,
  config: configRouter,
  complementItems: complementItemsRouter,
});

export type AppRouter = typeof appRouter;
