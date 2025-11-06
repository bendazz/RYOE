select ydstogo,avg(yards_gained) as avg_yards_gained
from team_data_combined
where rush_attempt = 1
group by ydstogo


select rusher_player_id, rusher_player_name, 
       avg(yards_gained - (3.47336519+0.12588674*ydstogo)) as yards_above_expected,count(*) as rush_attempts
from team_data_combined
where rush_attempt = 1 
group by rusher_player_id
order by yards_above_expected desc