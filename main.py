"""Launcher for the bank_pdf package.

This file is a thin entry point so users can run `python main.py`.
"""

from bank_pdf import cli


def main():
	cli.main()


if __name__ == '__main__':
	main()