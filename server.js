const cookieParser = require("cookie-parser");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const supabase = require("./config/supabase");
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const folderRoutes = require("./routes/folderRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use("/api/files", fileRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/folders", folderRoutes);

// Basic test
app.get("/", (req, res) => {
  res.json({
    message: "Cloud Media Storage API is running"
  });
});

// Supabase connection test
app.get("/api/test-supabase", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .limit(1);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      message: "Supabase connection successful",
      data: data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
app.get("/api/test-write", async (req, res) => {
  try {
    // 1. Get a user to use as owner
    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (userError) {
      return res.status(500).json({
        success: false,
        step: "find-user",
        error: userError.message
      });
    }

    // No users exist yet because authentication isn't implemented
    if (!users || users.length === 0) {
      return res.json({
        success: true,
        message: "Database connection works, but no user exists yet.",
        note: "INSERT test will be done after Day 2 authentication."
      });
    }

    const userId = users[0].id;

    // 2. Insert temporary folder
    const { data: folder, error: insertError } = await supabase
      .from("folders")
      .insert({
        name: "TEST_FOLDER_DELETE_ME",
        owner_id: userId
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        success: false,
        step: "insert",
        error: insertError.message
      });
    }

    // 3. Delete temporary folder
    const { error: deleteError } = await supabase
      .from("folders")
      .delete()
      .eq("id", folder.id);

    if (deleteError) {
      return res.status(500).json({
        success: false,
        step: "delete",
        error: deleteError.message,
        folderCreated: folder
      });
    }

    res.json({
      success: true,
      message: "INSERT and DELETE permissions are working!",
      testFolderCreated: folder.name,
      testFolderDeleted: true
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});