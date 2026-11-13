import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import { Db, MongoClient } from "mongodb";

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI || "mongodb://127.0.0.1:27017");
const dbName = process.env.DB_NAME || "booknook";

let db: Db;

async function connectDb() {
  await client.connect();
  db = client.db(dbName);
  console.log("Connected to MongoDB:", dbName);
}

app.get("/", (req: Request, res: Response) => {
  res.send("BookNook API is running");
});

const port = process.env.PORT || 5000;

connectDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`BookNook server running on port ${port}`);
    });
  })
  .catch((error: Error) => {
    console.log("MongoDB connection failed:", error.message);
    process.exit(1);
  });
