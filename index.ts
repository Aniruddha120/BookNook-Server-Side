import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.send("BookNook API is running");
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`BookNook server running on port ${port}`);
});
