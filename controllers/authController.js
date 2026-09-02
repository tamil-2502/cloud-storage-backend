const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const supabase = require("../config/supabase");

// =========================
// REGISTER
// =========================
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Check if user already exists in users table
    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({
        success: false,
        message: existingError.message
      });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists"
      });
    }

    // =========================
    // CREATE USER IN SUPABASE AUTH
    // =========================
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    const userId = authData.user.id;

    // =========================
    // HASH PASSWORD
    // =========================
    const hashedPassword = await bcrypt.hash(password, 10);

    // =========================
    // CREATE USER PROFILE
    // =========================
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({
        id: userId,
        email: email,
        name: name,
        password: hashedPassword
      })
      .select("id, name, email, created_at")
      .single();

    // If profile creation fails,
    // delete the Auth user
    if (userError) {
      await supabase.auth.admin.deleteUser(userId);

      return res.status(500).json({
        success: false,
        message: userError.message
      });
    }

    // =========================
    // CREATE JWT
    // =========================
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    // =========================
    // STORE TOKEN IN COOKIE
    // =========================
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    });

    // =========================
    // RESPONSE
    // =========================
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// =========================
// LOGIN
// =========================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    // =========================
    // FIND USER
    // =========================
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      return res.status(500).json({
        success: false,
        message: userError.message
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // =========================
    // COMPARE PASSWORD
    // =========================
    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

   // =========================
// GENERATE JWT TOKEN
// =========================
const token = jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: user.role
  },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

// =========================
// STORE TOKEN IN COOKIE
// =========================
res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000
});

// =========================
// RESPONSE
// =========================
return res.json({
  success: true,
  message: "Login successful",
  token,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  }
});

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

const resetOwnerPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Find user in users table
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      return res.status(500).json({
        success: false,
        message: findError.message
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in users table
    const { error: updateError } = await supabase
      .from("users")
      .update({
        password: hashedPassword
      })
      .eq("id", user.id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        message: updateError.message
      });
    }

    // Update password in Supabase Auth
    const { error: authError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword
      });

    if (authError) {
      return res.status(500).json({
        success: false,
        message: authError.message
      });
    }

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Reset password error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// EXPORT

module.exports = {
  register,
  login,
  resetOwnerPassword
};
