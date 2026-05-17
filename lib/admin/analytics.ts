import type { SupabaseClient } from '@supabase/supabase-js';

export type RangeSummary = {
  slots_count: number;
  sessions_count: number;
  total_players: number;
  avg_players_slot: number;
  max_players_slot: number;
  attended_players: number;
  ghost_players: number;
};

export type MonthlyTrendRow = {
  month_start: string;
  slots_count: number;
  sessions_count: number;
  total_players: number;
  avg_players_slot: number;
  attended_players: number;
  ghost_players: number;
};

export async function getRangeSummary(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
): Promise<RangeSummary> {
  const { data, error } = await supabase.rpc('analytics_range_summary', {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {
    slots_count: 0,
    sessions_count: 0,
    total_players: 0,
    avg_players_slot: 0,
    max_players_slot: 0,
    attended_players: 0,
    ghost_players: 0,
  }) as RangeSummary;
}

export async function getMonthlyTrend(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
): Promise<MonthlyTrendRow[]> {
  const { data, error } = await supabase.rpc('analytics_monthly_trend', {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) throw error;
  return (data ?? []) as MonthlyTrendRow[];
}

export type CoachAttendanceRow = {
  coach_id: string;
  coach_name: string;
  session_count: number;
};

export type AwardLeaderboardRow = {
  player_key: string;
  player_name: string;
  is_ghost: boolean;
  award_count: number;
};

export async function getCoachAttendance(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
): Promise<CoachAttendanceRow[]> {
  const { data, error } = await supabase.rpc('analytics_coach_attendance', {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) throw error;
  return (data ?? []) as CoachAttendanceRow[];
}

export async function getCaptainLeaderboard(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
): Promise<AwardLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('analytics_captain_leaderboard', {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) throw error;
  return (data ?? []) as AwardLeaderboardRow[];
}

export async function getPotwLeaderboard(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
): Promise<AwardLeaderboardRow[]> {
  const { data, error } = await supabase.rpc('analytics_potw_leaderboard', {
    p_start: rangeStart,
    p_end: rangeEnd,
  });
  if (error) throw error;
  return (data ?? []) as AwardLeaderboardRow[];
}

export type PlayerAttendanceRow = {
  player_key: string;
  player_name: string;
  is_ghost: boolean;
  attendance_count: number;
};

export async function getPlayerAttendance(
  supabase: SupabaseClient,
  rangeStart: string,
  rangeEnd: string,
  limit: number | null = null,
): Promise<PlayerAttendanceRow[]> {
  const { data, error } = await supabase.rpc('analytics_player_attendance', {
    p_start: rangeStart,
    p_end: rangeEnd,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as PlayerAttendanceRow[];
}
