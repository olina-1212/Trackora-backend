import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import auth from "./middleware/auth.js";
const app = express();
const prisma = new PrismaClient();
app.use(express.json())
app.use(cors());

app.get("/",(req,res)=> {
    res.send("Backend working");
})

//auth

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

   const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET
    );
   
    res.json({
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
  },
});

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Something went wrong",
    });

  }
});

app.post("/login", async (req, res) => {

  const { email, password } = req.body;

  try {

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        error: "User not found",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(400).json({
        error: "Invalid password",
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET
    );

    res.json({
  token,
  user: {
    name: user.name,
    email: user.email,
  },
});

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Something went wrong",
    });

  }
});

//applications model


import auth from "./middleware/auth.js"; // adjust path if needed

// GET ALL APPLICATIONS (USER SPECIFIC)
app.get("/applications", auth, async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: {
        userId: req.userId,
      },
    });

    res.json(applications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// GET SINGLE APPLICATION
app.get("/applications/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const appData = await prisma.application.findUnique({
      where: { id },
    });

    if (!appData) {
      return res.status(404).json({ error: "Not found" });
    }

    res.json(appData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// CREATE APPLICATION
app.post("/applications", auth, async (req, res) => {
  try {
    const { company, role, status, deadline } = req.body;

    const newApp = await prisma.application.create({
      data: {
        company,
        role,
        status,
        deadline: new Date(deadline),
        userId: req.userId,
      },
    });

    res.json(newApp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});


// UPDATE APPLICATION
app.put("/applications/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { company, role, status, deadline } = req.body;

    const updatedApplication = await prisma.application.update({
      where: { id },
      data: {
        company,
        role,
        status,
        deadline: new Date(deadline),
      },
    });

    res.json(updatedApplication);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// DELETE APPLICATION
app.delete("/applications/:id", auth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application || application.userId !== req.userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await prisma.application.delete({
      where: { id },
    });

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// model problem

app.post("/problems",auth, async (req,res)=>{
  try{
    const{title,topic,difficulty}=req.body

    const today=new Date();
    today.setHours(0,0,0,0)
    const problem=await prisma.problem.create({
      data:{
        title,
        topic,
        difficulty,
        dateSolved: new Date(),
        userId: req.userId,
      },
    });

    const existing =await prisma.activityLog.findFirst({
      where:{date: today},
    });
    if (existing){
      await prisma.activityLog.update({
        where: {id: existing.id},
        data: {
          problemsSolvedCount: existing.problemsSolvedCount + 1
        },
      });
    } else{
      await prisma.activityLog.create({
        data: {
          date: today,
          problemsSolvedCount: 1
        },
      });
    }

    res.json(problem);
  }
  catch(error){
    console.error(error);
    res.status(500).json({error:"Error adding problem"});
  }
  });

app.get("/problems", auth, async (req,res)=>{

  const problems = await prisma.problem.findMany({

    where: {
      userId: req.userId,
    },

    orderBy: {
      dateSolved: "desc"
    },

  });

  res.json(problems);

});



//dashboard
app.get("/dashboard", async (req, res) => {
  try {
    const totalProblems = await prisma.problem.count();

    const problems = await prisma.problem.findMany();

    const topicSummary = {};

    // build topic summary
    problems.forEach((p) => {
      if (!topicSummary[p.topic]) {
        topicSummary[p.topic] = 0;
      }
      topicSummary[p.topic]++;
    });

    // find weak topic
    let weakTopic = null;
    let minCount = Infinity;

    for (let topic in topicSummary) {
      if (topicSummary[topic] < minCount) {
        minCount = topicSummary[topic];
        weakTopic = topic;
      }
    }

    // get activity
    const activity = await prisma.activityLog.findMany({
      orderBy: { date: "asc" },
    });

    res.json({
      totalProblems,
      topicSummary,
      weakTopic,
      activity,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Dashboard error" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});