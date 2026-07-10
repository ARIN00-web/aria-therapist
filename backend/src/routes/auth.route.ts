import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User.model';

const router = Router();
const SALT_ROUNDS = 10;

type PreferredModality = 'CBT' | 'DBT' | 'ACT' | 'Person-centred' | 'Motivational Interviewing';

interface SignupBody {
  name?: string;
  email?: string;
  password?: string;
  preferredModality?: PreferredModality;
  timezone?: string;
  onboardingAnswers?: Record<string, unknown>;
}

interface LoginBody {
  email?: string;
  password?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signAccessToken(userId: string, email: string): string {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { id: userId, email },
    jwtSecret,
    { expiresIn: '15m' }
  );
}

router.post('/api/auth/signup', async (req, res) => {
  const {
    name,
    email,
    password,
    preferredModality,
    timezone,
    onboardingAnswers,
  } = req.body as SignupBody;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (!trimmedName) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({
      name: trimmedName,
      email: normalizedEmail,
      password: hashedPassword,
      preferredModality,
      timezone: timezone?.trim() || 'UTC',
      onboardingAnswers: onboardingAnswers ?? {},
    });

    const token = signAccessToken(user._id.toString(), user.email);

    return res.status(201).json({
      message: 'Signup successful',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredModality: user.preferredModality,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    console.error('[Auth] Signup failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as LoginBody;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const user = await UserModel.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signAccessToken(user._id.toString(), user.email);

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredModality: user.preferredModality,
        timezone: user.timezone,
      },
    });
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
