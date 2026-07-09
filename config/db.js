import knex from "knex";
import { attachPaginate } from "knex-paginate";
import * as dotenv from 'dotenv' 
dotenv.config()
attachPaginate();

export const dbMaster = knex({
  client: "mssql",
  connection: {
    host: process.env.DB4_HOST,
    port: process.env.DB4_PORT,
    user: process.env.DB4_USERNAME,
    password: process.env.DB4_PASSWORD,
    timezone: "Asia/Jakarta",
    options: {
      instanceName: process.env.DB4_INSTANCE,
      database: process.env.DB4_DATABASE,
      debug: {
        packet: false,
        payload: false,
        token: false,
        data: false,
      },
    },
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
});

 export const dbHris = knex({
  client: "mssql",
  connection: {
    host: process.env.DB1_HOST,
    port: process.env.DB1_PORT,
    user: process.env.DB1_USERNAME,
    password: process.env.DB1_PASSWORD,
    timezone: "Asia/Jakarta",
    options: {
      instanceName: process.env.DB1_INSTANCE,
      database: process.env.DB1_DATABASE,
      debug: {
        packet: false,
        payload: false,
        token: false,
        data: false,
      },
    },
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
}); 


export const db = knex({
  client: "mssql",
  connection: {
    server: process.env.DB3_HOST,
    database: process.env.DB3_DATABASE,
    user: process.env.DB3_USERNAME,
    password: process.env.DB3_PASSWORD,
    options: {
      trustServerCertificate: true,
      encrypt: false,
      instanceName: process.env.DB3_INSTANCE,
    },
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createRetryIntervalMillis: 100,
  },
}); 
