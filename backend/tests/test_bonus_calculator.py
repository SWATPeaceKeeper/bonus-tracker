"""Tests for the bonus calculator service."""

from app.services.bonus_calculator import calculate_bonus


class TestCalculateBonus:
    """Tests for the calculate_bonus function."""

    def test_standard_calculation(self):
        # 10 hours * 150 EUR/h * 0.02 = 30.00
        assert calculate_bonus(10.0, 150.0, 0.02) == 30.0

    def test_zero_hours(self):
        assert calculate_bonus(0.0, 150.0, 0.02) == 0.0

    def test_none_hourly_rate(self):
        assert calculate_bonus(10.0, None, 0.02) == 0.0

    def test_zero_bonus_rate(self):
        assert calculate_bonus(10.0, 150.0, 0.0) == 0.0

    def test_rounding(self):
        # 3.33 * 99.99 * 0.02 = 6.659334 -> 6.66
        assert calculate_bonus(3.33, 99.99, 0.02) == 6.66

    def test_large_values(self):
        result = calculate_bonus(1000.0, 200.0, 0.05)
        assert result == 10000.0
