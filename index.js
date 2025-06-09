const express = require("express");
const http = require("http");
const axios = require("axios");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const QUIZ_URL = "https://raw.githubusercontent.com/yashksaini/quiz-app/refs/heads/main/src/assets/questions.ts";

let quizData = [];
let quizIndex = 0;
let userScores = {}; // { socket.id: score }

async function loadQuizData() {
  try {
    const response = await axios.get(QUIZ_URL);
    const rawText = response.data;

    // Extract JSON part (since this is a TypeScript file)
    const jsonMatch = rawText.match(/([\s\S]*)/);
    if (jsonMatch) {
      quizData = JSON.parse(jsonMatch[0]);
      quizIndex = 0;
      console.log(`Loaded ${quizData.length} questions.`);
    } else {
      console.error("Quiz JSON format not found.");
    }
  } catch (err) {
    console.error("Error fetching quiz data:", err);
  }
}

function sendNextQuestion() {
  if (quizIndex >= quizData.length) {
    // Send final scoreboard
    io.emit("quiz_scoreboard", userScores);
    // Restart quiz after 10 seconds
    setTimeout(() => {
      userScores = {};
      quizIndex = 0;
      sendNextQuestion();
    }, 10000);
    return;
  }

  const question = quizData[quizIndex];
  io.emit("quiz_question", {
    index: quizIndex + 1,
    total: quizData.length,
    question: question.question,
    options: question.options,
    answer: question.answer // You can remove this in production to prevent cheating
  });
  quizIndex++;
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  userScores[socket.id] = 0;

  // Send first question
  if (quizIndex < quizData.length) {
    sendNextQuestion();
  }

  socket.on("quiz_answer", (selectedAnswer) => {
    const correctAnswer = quizData[quizIndex - 1].answer;
    if (selectedAnswer === correctAnswer) {
      userScores[socket.id] += 1;
      socket.emit("quiz_result", { correct: true, message: "✅ Correct!" });
    } else {
      socket.emit("quiz_result", { correct: false, message: `❌ Wrong! Correct: ${correctAnswer}` });
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    delete userScores[socket.id];
  });
});

app.get("/", (req, res) => {
  res.send("Quiz Server Running");
});

server.listen(3000, async () => {
  console.log("Server running on port 3000");
  await loadQuizData();
  setInterval(() => {
    sendNextQuestion();
  }, 20000); // Broadcast next question every 20 seconds
});
