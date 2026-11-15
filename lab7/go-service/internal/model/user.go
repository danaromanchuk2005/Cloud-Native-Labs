package model

import "time"

type User struct {
	ID        string    `json:"id" bson:"_id,omitempty"`
	Name      string    `json:"name" bson:"name"`
	Email     string    `json:"email" bson:"email"`
	CreatedAt time.Time `json:"createdAt" bson:"createdAt"`
}

type Account struct {
	ID      int     `json:"id"`
	UserID  int     `json:"userId"`
	Balance float64 `json:"balance"`
}