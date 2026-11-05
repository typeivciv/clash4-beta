import {createIceHandler} from '../server/vercel-ice.mjs';

export default {fetch:createIceHandler(process.env)};
