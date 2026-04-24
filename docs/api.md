# API Documentation

The Campus Forum Connect API is a RESTful service driven by OpenAPI schemas and secured via session-based authentication.

## Authentication
Authentication is managed via `express-session` backed by a PostgreSQL session store.
- **`POST /api/auth/google`**: Handles Google OAuth login/registration. Exchanges a Google **access token** for a local user session. If the email is new, it automatically registers a new user with a generated secure local password hash.
- **`POST /api/auth/logout`**: Destroys the current user session.
- **`GET /api/auth/me`**: Returns the currently authenticated user's profile information.
- **`PATCH /api/auth/me`**: Updates the current user's profile (e.g., `displayName`).

## Posts & Activity
Posts are the core content unit. They are organized into sections and support threaded replies.

- **`GET /api/posts`**: Lists posts. Supports filtering by `section`, `authorId`, and `search` queries.
- **`GET /api/posts/:id`**: Retrieves a specific post alongside its full comment tree.
- **`POST /api/posts`**: Creates a new post. Requires `section`, `title`, and `body`.
- **`DELETE /api/posts/:id`**: Permanently deletes a post and cascades deletion to all child resources (comments, bookmarks, notifications).
- **`GET /api/posts/bookmarks`**: Retrieves a personalized feed of posts bookmarked by the authenticated user.
- **`GET /api/posts/activity`**: Retrieves a chronological feed of all posts and comments created by the authenticated user.
- **`POST /api/posts/:id/bookmark`**: Toggles the bookmark status for a specific post.
- **`POST /api/posts/:id/comments`**: Adds a new comment to a post. Supports `parentId` for nested replies.

## Notifications
- **`GET /api/notifications`**: Lists all unread or recent notifications for the authenticated user.
- **`POST /api/notifications/mark-read`**: Marks all notifications as read.

## Drafts
- **`GET /api/drafts`**: Retrieves autosaved drafts.
- **`POST /api/drafts`**: Saves a new draft or updates an existing one.
- **`DELETE /api/drafts/:id`**: Discards a saved draft.
