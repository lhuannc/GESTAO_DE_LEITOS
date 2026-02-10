# Cookie-Based Authentication Implementation Plan

## 📋 Overview

Replace current localStorage authentication with secure cookie-based JWT tokens that persist for 30 days, maintaining user sessions across page refreshes.

## 🎯 Goals

1. **Persistent Sessions:** Users stay logged in after page refresh
2. **Secure Storage:** Use httpOnly cookies instead of localStorage
3. **30-Day Expiration:** Tokens valid for 30 days
4. **Proper Logout:** Destroy tokens on logout

---

## 📦 Required Dependencies

### Backend
```bash
npm install jsonwebtoken cookie-parser
npm install --save-dev @types/jsonwebtoken @types/cookie-parser
```

### Frontend
- No additional dependencies needed (use native `document.cookie`)

---

## 🔧 Implementation Steps

### 1. Backend - JWT Token Generation

#### **File:** `apps/api/src/routers/auth.ts`

**Changes:**
- Add JWT signing on successful login
- Set httpOnly cookie with 30-day expiration
- Return user data (without password)

**New Code:**
```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const COOKIE_NAME = 'auth_token';

// In login mutation:
const token = jwt.sign(
  { userId: user.id, companyId: user.companyId },
  JWT_SECRET,
  { expiresIn: '30d' }
);

// Set cookie in response (via context)
ctx.res.cookie(COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/'
});
```

---

### 2. Backend - Cookie Middleware

#### **File:** `apps/api/src/server.ts`

**Changes:**
- Add `cookie-parser` middleware
- Update CORS to allow credentials

**New Code:**
```typescript
import cookieParser from 'cookie-parser';

// Add middleware
app.use(cookieParser());

// Update CORS
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

---

### 3. Backend - Token Verification Middleware

#### **File:** `apps/api/src/trpc.ts`

**Changes:**
- Read token from cookies
- Verify JWT and attach user to context
- Handle expired/invalid tokens

**New Code:**
```typescript
import jwt from 'jsonwebtoken';

const createContext = async ({ req, res }: { req: any; res: any }) => {
  const token = req.cookies?.auth_token;
  
  let user = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });
    } catch (error) {
      // Token invalid or expired
      res.clearCookie('auth_token');
    }
  }

  return { prisma, user, req, res };
};
```

---

### 4. Backend - Logout Endpoint

#### **File:** `apps/api/src/routers/auth.ts`

**Changes:**
- Add logout mutation
- Clear auth cookie

**New Code:**
```typescript
logout: publicProcedure
  .mutation(async ({ ctx }) => {
    ctx.res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    
    return { success: true };
  })
```

---

### 5. Frontend - Auto-Login on Mount

#### **File:** `apps/web/src/App.tsx`

**Changes:**
- Add `me` query to check current session
- Auto-populate `currentUser` if token valid
- Remove localStorage logic

**New Code:**
```typescript
// Add at top of App component
const { data: sessionUser, isLoading: sessionLoading } = trpc.auth.me.useQuery(undefined, {
  retry: false,
  refetchOnWindowFocus: false
});

useEffect(() => {
  if (sessionUser && !currentUser) {
    setCurrentUser(sessionUser);
  }
}, [sessionUser]);
```

---

### 6. Frontend - Login Flow Update

#### **File:** `apps/web/src/components/Login.tsx`

**Changes:**
- Remove localStorage.setItem
- Rely on cookie set by backend
- Call parent callback on success

**Updated:**
```typescript
const handleLogin = async () => {
  try {
    const user = await loginMutation.mutateAsync({ cpf, password });
    onLoginSuccess(user); // Cookie already set by backend
  } catch (error) {
    // Handle error
  }
};
```

---

### 7. Frontend - Logout Flow Update

#### **File:** `apps/web/src/App.tsx`

**Changes:**
- Call logout mutation
- Clear currentUser state
- Cookie destroyed by backend

**Updated:**
```typescript
const logoutMutation = trpc.auth.logout.useMutation();

const handleLogout = async () => {
  await logoutMutation.mutateAsync();
  setCurrentUser(null);
};
```

---

### 8. Frontend - tRPC Client Configuration

#### **File:** `apps/web/src/lib/trpc.ts`

**Changes:**
- Enable credentials in fetch
- Allow cookies to be sent

**Updated:**
```typescript
const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:4000/trpc',
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include' // Important!
        });
      }
    })
  ]
});
```

---

## 🔒 Security Considerations

### ✅ Best Practices Implemented

1. **httpOnly Cookies:** Prevents XSS attacks
2. **sameSite: 'lax':** Prevents CSRF attacks
3. **secure flag:** HTTPS only in production
4. **30-day expiration:** Reasonable session length
5. **JWT Secret:** Store in environment variable

### ⚠️ Important Notes

- **JWT_SECRET:** Must be set in `.env` file
- **HTTPS in Production:** Enable `secure: true`
- **Token Rotation:** Consider implementing refresh tokens for enhanced security

---

## 🧪 Testing Checklist

- [ ] Login sets cookie correctly
- [ ] Page refresh maintains session
- [ ] Cookie expires after 30 days
- [ ] Logout clears cookie
- [ ] Invalid token redirects to login
- [ ] Expired token redirects to login
- [ ] Multiple tabs share same session

---

## 📝 Environment Variables

Add to `.env` files:

```bash
# Backend (.env)
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
NODE_ENV=development
```

---

## 🚀 Deployment Notes

### Production Checklist

1. Generate strong JWT_SECRET (min 32 characters)
2. Set `NODE_ENV=production`
3. Ensure HTTPS is enabled
4. Update CORS origin to production domain
5. Test cookie behavior across domains

---

## 📊 Migration Path

1. Deploy backend changes first
2. Deploy frontend changes
3. Existing users will need to re-login once
4. Old localStorage data can be ignored (will be overwritten)
