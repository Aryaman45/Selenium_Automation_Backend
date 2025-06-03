const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/userModel');
const { JWT_SECRET } = require('../config/keys');

exports.register = async (req, res) => {
  console.log('=== REGISTRATION FUNCTION CALLED ===');
  console.log('Current code version: Using email-based registration');
  
  try {
    console.log('Registration request received. Body:', req.body);
    console.log('Request headers:', req.headers);
    
    const { email, password } = req.body;
    console.log('Extracted email:', email);
    console.log('Extracted password:', password ? '***' : undefined);

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ 
        message: 'Email and password are required',
        receivedData: {
          email: email || 'missing',
          password: password ? 'present' : 'missing'
        }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(400).json({ message: 'Email already registered' });
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      console.log('Password hashed successfully');
      
      const user = new User({ email, password: hash });
      console.log('User object created:', { email, password: '***' });
      
      await user.save();
      console.log('User saved to database successfully');

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
      
      res.status(201).json({ 
        message: 'User registered successfully',
        token 
      });
    } catch (dbError) {
      console.error('Database operation error:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Registration error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    res.status(500).json({ 
      message: 'Error registering user', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        name: error.name,
        code: error.code,
        stack: error.stack
      } : undefined
    });
  }
};

exports.login = async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      console.log('Invalid credentials for user:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
    });

    console.log('User logged in successfully:', email);
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
};
