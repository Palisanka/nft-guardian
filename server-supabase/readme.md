# Invoke the function to check if the sl has hits

## todo

- replace [url] by your url : http://localhost... or the remote supabase url
- replace [bearer] by your bearer key that you can find in supabase
- deploy the edge function in supabase
- test with curl
- use the sql request in supabase to program the cron job (needs cron+net plugins)

// curl for local and remote testing

```
curl -i --location --request POST '[url]' \
--header 'Authorization: Bearer [bearer]' \
--header 'Content-Type: application/json'
```

// Supabase remote query to execute the function every minutes

```
select
  cron.schedule(
    'invoke-function-every-minute',
    '* * * * *', -- every minute
    $$
    select
      net.http_post(
        url:='[url]',
        headers:='{
          "Content-Type": "application/json",
          "Authorization": "Bearer [bearer]"
        }'::jsonb
      ) as request_id;
    $$
  );
```
