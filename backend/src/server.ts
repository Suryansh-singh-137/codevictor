import { sql } from "./db.js";
import express from "express";
const app = express();
const result = await sql`SELECT NOW()`;
console.log(result);
