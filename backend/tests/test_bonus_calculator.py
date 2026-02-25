"""Tests for the bonus calculator service."""

from app.services.bonus_calculator import calculate_bonus


class TestCalculateBonus:
    """Tests for the calculate_bonus function."""

    def test_remote_only(self):
        result = calculate_bonus(
            remote_hours=10.0, onsite_hours=0.0,
            hourly_rate=150.0, onsite_hourly_rate=None,
            bonus_rate=0.02,
        )
        assert result == 30.0

    def test_onsite_with_own_rate(self):
        # 5 remote * 120 * 0.02 = 12.0
        # 3 onsite * 150 * 0.02 = 9.0
        result = calculate_bonus(
            remote_hours=5.0, onsite_hours=3.0,
            hourly_rate=120.0, onsite_hourly_rate=150.0,
            bonus_rate=0.02,
        )
        assert result == 21.0

    def test_onsite_falls_back_to_hourly_rate(self):
        # (5 + 3) * 120 * 0.02 = 19.2
        result = calculate_bonus(
            remote_hours=5.0, onsite_hours=3.0,
            hourly_rate=120.0, onsite_hourly_rate=None,
            bonus_rate=0.02,
        )
        assert result == 19.2

    def test_zero_hours(self):
        result = calculate_bonus(
            remote_hours=0.0, onsite_hours=0.0,
            hourly_rate=150.0, onsite_hourly_rate=None,
            bonus_rate=0.02,
        )
        assert result == 0.0

    def test_none_hourly_rate(self):
        result = calculate_bonus(
            remote_hours=10.0, onsite_hours=5.0,
            hourly_rate=None, onsite_hourly_rate=None,
            bonus_rate=0.02,
        )
        assert result == 0.0

    def test_zero_bonus_rate(self):
        result = calculate_bonus(
            remote_hours=10.0, onsite_hours=5.0,
            hourly_rate=150.0, onsite_hourly_rate=180.0,
            bonus_rate=0.0,
        )
        assert result == 0.0

    def test_rounding(self):
        result = calculate_bonus(
            remote_hours=3.33, onsite_hours=0.0,
            hourly_rate=99.99, onsite_hourly_rate=None,
            bonus_rate=0.02,
        )
        assert result == 6.66
