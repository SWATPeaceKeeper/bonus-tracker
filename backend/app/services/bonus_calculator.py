"""Bonus calculation utilities."""


def calculate_bonus(
    remote_hours: float,
    onsite_hours: float,
    hourly_rate: float | None,
    onsite_hourly_rate: float | None,
    bonus_rate: float,
) -> float:
    """Calculate bonus amount with remote/onsite split.

    Args:
        remote_hours: Hours worked remotely.
        onsite_hours: Hours worked on-site.
        hourly_rate: Remote rate per hour (None treated as 0).
        onsite_hourly_rate: On-site rate (falls back to hourly_rate).
        bonus_rate: Bonus percentage as decimal (e.g. 0.02 = 2%).

    Returns:
        Rounded bonus amount.
    """
    rate = hourly_rate or 0.0
    onsite_rate = onsite_hourly_rate or rate
    remote_bonus = remote_hours * rate * bonus_rate
    onsite_bonus = onsite_hours * onsite_rate * bonus_rate
    return round(remote_bonus + onsite_bonus, 2)
