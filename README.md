# 🍳 CookMate — AI Cooking Sous Chef

**CookMate is an AI-powered cooking sous chef web application built with React, TypeScript, Node.js, Express, Supabase, and Google ADK that helps users generate recipes, cook with live visual guidance, and automatically log meals and macros.**

CookMate combines computer vision, conversational AI agents, and generative media to guide users through cooking meals step-by-step. The system acts like a real-time AI cooking assistant that can help users discover recipes, cook using ingredients they already have, and receive interactive guidance while preparing food.

---

## Current Local Scaffold (Implemented in This Repo)

This repository currently includes a **minimal local development setup** for frontend/backend connectivity and mocked recipe responses.

### What Works Today
- Frontend served at `http://localhost:3000`
- Backend served at `http://localhost:5000`
- Single endpoint:
  - Method: `POST`
  - Path: `/api/recipe`
  - URL: `http://localhost:5000/api/recipe`
- Mocked backend response only (no DB, no external APIs)

### Example Request Body

```json
{
  "dish": "chicken"
}
```

### Example Response

```json
{
  "recipe name": "chicken and rice",
  "ingredients": ["chicken", "rice"],
  "instructions": "cook the chicken and rice"
}
```

### Frontend Behavior
- Input labeled: `What would you like to cook?`
- User enters dish and clicks `Search`
- Shows `loading` during request
- Shows recipe name, ingredients, and instructions on success
- Shows error message on failure

### Local Run

```bash
npm install --prefix server
npm install
npm run dev
```

Then open `http://localhost:3000`.

---

# 🚀 Product Features (Target Vision)

## 🔐 Authentication
- Secure sign-in using Google OAuth
- Personalized user profiles
- Persistent user data including recipes and meal logs

---

## 🧑‍🍳 Recipe Creation

Users can start cooking in two different ways:

### 1️⃣ Use a Pre-Existing Recipe

Users can:
- Paste a recipe link into an input box
- Ask the AI agent to generate a recipe for a specific dish

The AI agent can also:
- Adapt recipes
- Suggest ingredient substitutions
- Adjust recipes based on user preferences

---

### 2️⃣ Cook From Scratch (AI Ingredient Detection)

Users can enable their camera to start a live cooking session.

The CookMate AI agent will:
- Identify ingredients in real time
- Suggest recipes based on detected ingredients
- Converse with the user to refine the recipe
- Help design a custom recipe based on available ingredients

Example interaction:

User:
"What can I cook with these ingredients?"

Agent:
"You have chicken, garlic, onions, and tomatoes. You could make garlic chicken stir fry or a simple tomato chicken skillet. Which would you like?"

---

## 🎥 Real-Time Cooking Guidance

Once a recipe has been selected, CookMate becomes a live AI sous chef.

Using the camera feed, the agent can:
- Provide step-by-step cooking instructions
- Verify that steps are completed correctly
- Monitor cooking progress

Examples of verification:
- Correct browning of meat
- Proper vegetable cutting size
- Cooking stage identification
- Ingredient preparation

The user can interact with the agent at any time:
- “Is this browned enough?”
- “Did I cut this correctly?”

---

## 🎨 AI Visual Cooking Instructions

CookMate enhances instructions using AI-generated visuals.

For each step the system can generate:
- Instructional images
- Animated cooking demonstrations
- Visual references for cooking techniques

Examples:
- Knife cutting styles
- Proper browning levels
- Sauce thickness
- Vegetable sizes

This allows users to learn visually while cooking.

---

## 🥗 Nutrition Tracking

After the recipe is completed:

The meal is automatically stored in the user's daily meal log.

CookMate calculates and tracks:
- Calories
- Protein
- Carbohydrates
- Fats

Users can review their daily and historical nutrition data inside the application.

---

## 🧠 AI Capabilities

CookMate integrates several AI systems.

### Conversational Cooking Agent
Built using Google Agent Development Kit (ADK).

The cooking agent can:
- Generate recipes
- Guide cooking sessions
- Answer cooking questions
- Adapt instructions dynamically

### Computer Vision
Vision models enable:
- Ingredient detection
- Cooking stage recognition
- Food texture identification

The system uses live camera input to monitor cooking progress.

### Generative Media
CookMate generates:
- Cooking instruction images
- Animated demonstrations
- Visual technique explanations

These visuals help users better understand cooking instructions.

---

## 🏗 Tech Stack

### Frontend
- React
- TypeScript
- TailwindCSS
- WebRTC (live camera feed)

### Backend
- Node.js
- Express
- TypeScript
- WebSockets for real-time communication

### Database & Backend Platform
- Supabase
  - PostgreSQL database
  - Authentication
  - Storage
  - Realtime subscriptions

Supabase stores:
- User profiles
- Recipes
- Cooking sessions
- Ingredient data
- Meal logs
- Nutrition macros

### AI / Agent Infrastructure
- Google Agent Development Kit (ADK)
- Computer vision models for ingredient detection
- Conversational LLM cooking agent
- AI image generation for instructional visuals

---

## ⚙️ System Architecture

```text
Client (React + TypeScript)
        │
        │ WebSocket / REST
        ▼
Backend API (Node.js + Express)
        │
        ├── Agent Service (Google ADK)
        │      ├── Recipe generation
        │      ├── Conversational cooking agent
        │      └── Instruction generation
        │
        ├── Vision Service
        │      ├── Ingredient detection
        │      └── Cooking step verification
        │
        ├── Media Generation Service
        │      ├── Instruction images
        │      └── Cooking animations
        │
        ▼
Supabase (Postgres)
(User data, recipes, sessions, meal logs)
```

---

## 📹 Example User Flow

1. User signs in using Google OAuth
2. User chooses one of the following options:
   - Generate recipe
   - Import recipe from link
   - Cook using available ingredients
3. If cooking from ingredients:
   - Camera activates
   - AI detects ingredients
4. AI suggests possible recipes
5. User selects recipe
6. CookMate guides the cooking process:
   - Live instructions
   - Visual demonstrations
   - Camera verification of steps
7. Meal is completed and logged with nutrition macros

---

## 📁 Project Structure

```text
cookmate
│
├── client
│   ├── components
│   ├── pages
│   ├── hooks
│   └── styles
│
├── server
│   ├── controllers
│   ├── routes
│   ├── services
│   │     ├── agent
│   │     ├── vision
│   │     └── media
│   └── utils
│
├── database
│   └── migrations
│
└── README.md
```

---

## 🔮 Future Improvements

- Voice-controlled cooking
- Grocery list generation
- Pantry inventory tracking
- Meal planning tools
- Mobile application
- Smart kitchen device integration
- Community recipe sharing

---

## 🎯 Vision

CookMate aims to become a true AI cooking companion that helps users cook confidently, learn new techniques, and make the most of the ingredients they already have.

The goal is to transform cooking into a guided, interactive, and intelligent experience powered by AI.
