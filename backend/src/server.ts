import { app } from './app.js';
import { env } from './config/env.js';
app.listen(env.port, '0.0.0.0', () => console.log(JSON.stringify({ level:'info', msg:'Shelfwise API listening', port:env.port, environment:env.nodeEnv })));
