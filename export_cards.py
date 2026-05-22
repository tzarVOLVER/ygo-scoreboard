import requests
import csv

url = "https://db.ygoprodeck.com/api/v7/cardinfo.php"
data = requests.get(url).json()

with open("card_names.csv", "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["Card Name"])  # header
    
    for card in data["data"]:
        writer.writerow([card["name"]])

print("Done! card_names.csv created.")
