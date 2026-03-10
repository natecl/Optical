# CookMate Minimal Local Setup

This project provides a minimal frontend + backend local development scaffold.

## Project Structure

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
│   │   ├── agent
│   │   ├── vision
│   │   └── media
│   └── utils
│
├── database
│   └── migrations
│
└── README.md
```

## API

- Method: `POST`
- Path: `/api/recipe`
- URL: `http://localhost:5000/api/recipe`
- Example request body:

```json
{
  "dish": "chicken"
}
```

- Success response:

```json
{
  "recipe name": "chicken and rice",
  "ingredients": ["chicken", "rice"],
  "instructions": "cook the chicken and rice"
}
```

## Run Locally

1. Install dependencies:

```bash
npm install --prefix server
npm install
```

2. Start backend and frontend:

```bash
npm run dev
```

3. Open `http://localhost:3000`.

Use the input labeled `What would you like to cook?`, enter a dish, and click `Search`.

- `loading` is shown while waiting
- recipe name, ingredients, and instructions are shown on success
- an error message is shown on failure
