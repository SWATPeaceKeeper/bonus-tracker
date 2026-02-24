"""Bonus calculation utilities."""


def calculate_bonus(
    hours: float,
    hourly_rate: float | None,
    bonus_rate: float,
) -> float:
    """Calculate bonus amount from hours, rate, and bonus percentage.

    Args:
        hours: Total hours worked.
        hourly_rate: Rate per hour (None treated as 0).
        bonus_rate: Bonus percentage as decimal (e.g. 0.02 = 2%).

    Returns:
        Rounded bonus amount.
    """
    rate = hourly_rate or 0.0
    return round(hours * rate * bonus_rate, 2)
