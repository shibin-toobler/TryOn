import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Optional, since Google OAuth won't have a password
      required: false,
    },
    image: {
      type: String,
      required: false,
    }
  },
  { timestamps: true }
);

// This ensures Mongoose doesn't try to recompile the model if it's already compiled
export default mongoose.models.StoreUser || mongoose.model('StoreUser', UserSchema);
