.PHONY: up down restart logs open clean rebuild

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose down && docker compose up -d

logs:
	docker compose logs -f

rebuild:
	docker compose up -d --build event-generator

open:
	open http://localhost:3000/d/browser-overview

clean:
	docker compose down -v --remove-orphans
