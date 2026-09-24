.PHONY: dev down logs migrate migration seed test lint clean pdf-all

dev:
	docker compose -f docker-compose.dev.yml up --build

down:
	docker compose -f docker-compose.dev.yml down

logs:
	docker compose -f docker-compose.dev.yml logs -f

migrate:
	docker compose -f docker-compose.dev.yml exec backend alembic upgrade head

migration:
	@read -p "Migration name: " name; \
	docker compose -f docker-compose.dev.yml exec backend \
	  alembic revision --autogenerate -m "$$name"

seed:
	docker compose -f docker-compose.dev.yml exec backend python -m app.utils.seed

test:
	docker compose -f docker-compose.dev.yml exec backend pytest -v

lint:
	docker compose -f docker-compose.dev.yml exec backend ruff check .
	docker compose -f docker-compose.dev.yml exec frontend npm run lint

clean:
	docker compose -f docker-compose.dev.yml down -v
	rm -rf frontend/node_modules frontend/.next
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

pdf-all:
	@mkdir -p docs/pdf
	pandoc README.md -o docs/pdf/SOJIP-README.pdf \
	  --toc --toc-depth=3 --number-sections \
	  -V geometry:margin=1in -V fontsize=11pt -V colorlinks=true
	pandoc docs/architecture/system-design.md \
	  -o docs/pdf/SOJIP-System-Design.pdf \
	  --toc --toc-depth=3 --number-sections \
	  -V geometry:margin=1in -V fontsize=11pt -V colorlinks=true
	@echo "✓ PDFs generated in docs/pdf/"
