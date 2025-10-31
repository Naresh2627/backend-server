# 🚀 Habit Tracker - Backend Server

Express.js backend API for the Habit Tracker application with Supabase integration.

## ✨ Features

- 🔐 **Authentication**: JWT-based auth with Supabase
- 🎯 **Habit Management**: Full CRUD operations for habits
- 📊 **Progress Tracking**: Daily habit completion tracking
- 📅 **Calendar Data**: API endpoints for calendar views
- 🌐 **Social Sharing**: Progress sharing functionality
- 👤 **User Management**: Profile and account management
- 🔒 **Security**: Row Level Security (RLS) with Supabase
- 📝 **Validation**: Input validation and error handling

## 🛠️ Tech Stack

- **Express.js** - Web application framework
- **Supabase** - PostgreSQL database with real-time features
- **JWT** - JSON Web Token authentication
- **Express Validator** - Input validation middleware
- **CORS** - Cross-Origin Resource Sharing
- **Helmet** - Security middleware
- **Morgan** - HTTP request logger

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- Supabase account and project
- Database schema set up (see database folder)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Naresh2627/backend-server.git
   cd backend-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your configuration:
   ```env
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Start the development server**
   ```bash
   npm run server
   ```

   The API will be available at `http://localhost:5000`

## 📁 Project Structure

```
server/
├── config/
│   └── supabase.js         # Supabase client configuration
├── middleware/
│   └── auth.js             # JWT authentication middleware
├── routes/
│   ├── auth.js             # Authentication endpoints
│   ├── habits.js           # Habit management endpoints
│   ├── progress.js         # Progress tracking endpoints
│   ├── users.js            # User management endpoints
│   └── share.js            # Social sharing endpoints
├── index.js                # Main server file
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables template
└── README.md               # This file
```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/google` - Google OAuth

### Habits
- `GET /api/habits` - Get user's habits
- `POST /api/habits` - Create new habit
- `PUT /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit
- `GET /api/habits/categories` - Get habit categories

### Progress
- `GET /api/progress` - Get progress data
- `POST /api/progress/toggle` - Toggle habit completion
- `GET /api/progress/today` - Get today's progress
- `GET /api/progress/stats` - Get progress statistics
- `GET /api/progress/calendar/:year/:month` - Get calendar data

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/dashboard` - Get dashboard data
- `DELETE /api/users/account` - Delete user account

### Sharing
- `GET /api/share/stats` - Get shareable stats
- `POST /api/share/create` - Create shareable link
- `GET /api/share/:shareId` - Get shared progress
- `GET /api/share/user/links` - Get user's shared links
- `DELETE /api/share/:shareId` - Delete shared link

### Health Check
- `GET /api/health` - Server health status

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `CLIENT_URL` | Frontend URL for CORS | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Set up the database schema (see database documentation)
3. Get your project URL and service role key from Settings → API
4. Configure Row Level Security (RLS) policies

## 🚀 Deployment

### Deploy to Railway

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Deploy: `railway up`
4. Set environment variables in Railway dashboard

### Deploy to Heroku

1. Install Heroku CLI
2. Create app: `heroku create your-app-name`
3. Set environment variables: `heroku config:set SUPABASE_URL=...`
4. Deploy: `git push heroku main`

### Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard

## 🔒 Security Features

- **JWT Authentication** - Secure token-based authentication
- **Row Level Security** - Database-level access control
- **Input Validation** - Request validation with express-validator
- **CORS Protection** - Cross-origin request filtering
- **Helmet Security** - Security headers middleware
- **Environment Variables** - Sensitive data protection

## 🧪 Testing

### Manual Testing

Test the API endpoints using curl or Postman:

```bash
# Health check
curl http://localhost:5000/api/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## 📊 Database Schema

The server expects these tables in Supabase:

- **profiles** - User profiles and preferences
- **habits** - Habit definitions and metadata
- **progress** - Daily habit completion records
- **shared_progress** - Social sharing data

See the database folder for complete schema setup.

## 🐛 Troubleshooting

### Common Issues

1. **Supabase Connection Error**
   - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
   - Check if Supabase project is active
   - Ensure service role key (not anon key) is used

2. **Authentication Issues**
   - Verify JWT tokens are being sent correctly
   - Check RLS policies in Supabase
   - Ensure auth middleware is working

3. **CORS Errors**
   - Set correct CLIENT_URL in environment variables
   - Check CORS configuration in index.js

4. **Database Errors**
   - Ensure database schema is set up correctly
   - Check RLS policies are enabled
   - Verify table relationships

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add feature'`
6. Push: `git push origin feature-name`
7. Submit a pull request

## 📞 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the Supabase documentation
3. Create an issue in the GitHub repository

---

Built with ❤️ using Express.js and Supabase