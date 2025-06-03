const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    unique: true,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String,
    required: [true, 'Password is required']
  },
});

// Utility function to reset the collection (use only when needed)
const resetCollection = async () => {
  try {
    await mongoose.connection.collection('users').drop();
    console.log('Users collection dropped successfully');
  } catch (error) {
    if (error.code === 26) {
      console.log('Collection does not exist, creating new one');
    } else {
      console.error('Error dropping collection:', error);
    }
  }
};

// Export both the model and the reset function
module.exports = {
  User: mongoose.model('User', userSchema),
  resetCollection
};
