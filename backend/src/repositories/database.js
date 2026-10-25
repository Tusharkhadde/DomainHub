// Repository boundary: services use these dialect-neutral query/transaction primitives.
export {query,transaction,dialect,initDb,closeDb} from '../db/adapter.js';
