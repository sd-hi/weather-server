# weather-server
The `weather-server` application is a simple HTTP server that can receive temperature readings from multiple devices, and stores them in a MySQL database.

This allows you to use reporting tools (such as Grafana) to create a dashboard to illustrate a history of temperatures at multiple locations.

![Pasted image 20230819153215](https://github.com/sd-hi/weather-server/assets/96883126/7c73f78a-c56b-449a-ad36-7ef5ef96cdf4)

# Setup instructions
## Prerequisites
Setting up this server requires the following:
- Server or VPS running Linux (this documentation assumes Ubuntu 22.04)
- A MySQL database with the following:
	- Empty database named `weather`
	- User granted privileges on database `weather`
- Docker

Step by step instructions on setting up these prerequisites can be found in the Appendix section further down.

### System requirements
If you intend on running this application on the same machine as a MySQL database and a Grafana instance, these minimum specifications are recommended:
- 2 GB RAM
- 10 GB disk

## Installation
### Git checkout
First download the code from this repository.
```bash
git clone https://github.com/sd-hi/weather-server.git
```
Go into the created `weather-server` directory and copy the environment variables file `.env.example` to `.env`:
```bash
cd weather-server
cp .env.example .env
```
Now amend the `.env` file with your preferred text editor e.g.
```bash
nano .env
```
Set the variables based on guidance below

### Environment variables
Set the following environment variables:
- `DB_HOST` - Set this to the IP address of your MySQL database
- `DB_USER` - MySQL database username (e.g. `weatheruser`)
- `DB_PASS` - MySQL user's password
- `DB_NAME` - The database name in which the measurement will be stored (e.g. `weather`)
- `API_KEY` - The API key clients will use as the 'password' (passed on requests as a HTTP header `x-api-key`)

Save your changes and continue to deployment

### Deploy in Docker container
Now it is time to launch the web server by creating a docker container for it

Use the following  command to build the `weather-server` contents into a docker container image
```bash
sudo docker build -t weather-server .
```

Run the docker container:
```bash
sudo docker run -d -p 5000:3000 --name weather-server weather-server
```
Express will be running on port 3000 within the container. In this example
- `-p 5000:3000` directs port 3000 within the container to port 5000 on our VPS, so we should submit payloads to port 5000 when setting up clients
- `--name weather-server` will name our Docker container 'weather-server'

The container is now ready to receive API calls from Raspberry Pi devices running the `weather-client`

Tip: For debugging, you can inspect the live log of container `weather-server` with command `sudo docker logs -f weather-server` e.g.
```
user1@mymachine:~/weather-server$ sudo docker logs -f weather-server

> weather-server@1.0.0 start
> node index.js

Server running on http://localhost:3000
```
### Test function
Test connectivity with the server using the following curl command (replace `1.2.3.4` with server IP address, and `api_key_goes_here` with the API key configured in environment variable)
```bash
curl --location '1.2.3.4:5000/temperatures' \
--header 'x-api-key: api_key_goes_here' \
--header 'Content-Type: application/json' \
--data '{
    "deviceId": "device1",
    "locationId": "location1",
    "measurements": [
        {
            "dateTime": "2023-08-20T01:42:44.042Z",
            "humidity": 0.79,
            "temperature": 26.62
        },
        {
            "dateTime": "2023-08-20T01:42:46.042Z",
            "humidity": 0.79,
            "temperature": 26.62
        }
    ]
}'
```
A successful response should be returned
```json
{
  "message": "2 measurements added successfully"
}
```
# Appendix

## Installing Docker
Docker is a tool to containerize applications, making them easier to manage.
For details on how to install Docker see page https://docs.docker.com/engine/install/ubuntu/

To verify Docker is installed correctly you can run command
```
sudo docker run hello-world
```
Which should download a `hello-world` test container and print a confirmation message.

## Installing MySQL
### Create a MySQL container
If you already have a MySQL server deployed, this sub-section can be skipped.

Pull image from repository
```bash
sudo docker pull mysql:latest
```
Run the container
```bash
sudo docker run --name mysql -e MYSQL_ROOT_PASSWORD="rootpassword123" -p 3306:3306 -d mysql:latest
```
This creates a docker container named `mysql` containing the MySQL database with a root user `root` whose password is `rootpassword123` (pick something better!), it can be connected to on port 3306.

### Log into MySQL
Connect to the created docker container named `mysql`
```bash
sudo docker exec -it mysql bash
```
Now log into SQL with 
```
mysql -u root -p
```
Enter root password when prompted

### Create a database
Log into the MySQL console, create a database for the weather server application to write its data to.

Example below creates a database called `weather` (this is to be consistent with the environment variable `DB_NAME` for the `weather-server`)
```sql
CREATE DATABASE weather;
```
Create a database user `weatheruser` with password `password123` for the weather server to use
```sql
CREATE USER 'weatheruser'@'%' IDENTIFIED BY 'password123';
```
Grant the user access to everything on the `weather` database
```sql
GRANT ALL PRIVILEGES ON weather.* TO 'weatheruser'@'%';
```
Update the privileges with command
```sql
FLUSH PRIVILEGES;
```

## Using Grafana
### Grafana installation
Grafana is a powerful dashboard allowing you to easily view the time series data from the MySQL database
*For more information see https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/#use-persistent-storage-recommended*
Create a persistent volume for Grafana
```bash
sudo docker volume create grafana-storage
```
Verify storage was created correctly
```bash
sudo docker volume inspect grafana-storage
```
Start the Grafana container by running the following command:
```bash
sudo docker run -d -p 3000:3000 --name=grafana \
  --volume grafana-storage:/var/lib/grafana \
  grafana/grafana-enterprise
```
### MySQL DB user
Create a DB user `grafana` with access to the MySQL database.
Log into MySQL database
```bash
sudo docker exec -it mysql bash
```
Log into SQL prompt
```
mysql -u root -p
```
Create a grafana user
```sql
CREATE USER 'grafana'@'%' IDENTIFIED BY 'password123';
```
Grant the user appropriate permissions on the weather database
```sql
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER ON weather.* TO 'grafana'@'%';
```
Update the privileges with command
```sql
FLUSH PRIVILEGES;
```
### Grafana setup
#### Logging in to Grafana
Assuming the Grafana Docker container has been set up on port 3000, navigate to the VPS in web browser (where `1.2.3.4` is address of server)
```
1.2.3.4:3000
```
A Grafana login page should be presented
The default username and password is `admin:admin`
#### Setup MySQL as data source
- Click the menu symbol **≡**
- Choose "Data sources"
- On data sources pane, press "Add data source"
- Select `MySQL`
- Enter the MySQL database credentials for the user created earlier
	- Enter the host as `1.2.3.4:3306` (consistent with VPS IP and MySQL DB port)
	- Database is `weather`
	- User is `grafana` (password consistent with creation)
- Click "Save & test" at the bottom
You should see a message "Database Connection OK"
#### Build Grafana dashboard
*Tip: Insert some rows into the `temperatures` table in the MySQL `weather` database to prove the data points can be seen in the following dashboard. The easiest way to do this is to post some sample payloads to the weather server, see the "Test function" section above*
- Click the menu symbol **≡**
- Choose "Dashboards"
- Press "New" button
- Choose "New dashboard" from dropdown menu
- Choose "Add visualization"
- Choose MySQL database as the data source
##### Query pane
In the query pane on the bottom-left:
- Press "+ Query" to add a query
- Choose "Code" mode ("Builder/Code" switch on top-right)
- Enter the following query
```sql
Select
datetime as time,
temperature as "My Office"
FROM temperatures
WHERE locationid = "location1"
```
The above query will show all data points with a `locationid` of `location1` in the database, the dataset will be labeled "My Office"

Pressing "Run query" button should display the office data
![Pasted image 20230824002811](https://github.com/sd-hi/weather-server/assets/96883126/62e73682-b168-405e-a09a-8b4d61369a71)
Repeat this step, adding a query for for each location you wish to display on the dashboard. Feel free to set an appropriate title and customize to your preference.
![Pasted image 20230824003023](https://github.com/sd-hi/weather-server/assets/96883126/706646c5-1fd9-4442-9e61-33552a7cd263)
Press "Apply" button will create the new dashboard. Now you can use this dashboard to view the temperature data submitted to your `weather-server`!
