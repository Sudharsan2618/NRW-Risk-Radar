.PHONY: demo seed test

demo: seed
	uv run python apps/api/main.py

seed:
	uv run python synthetic/generate_portfolio.py

test:
	uv run python -m unittest discover -s tests -v
