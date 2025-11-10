# # # import os
# # # from zk import ZK, const
# # # # ensure .env.local values are loaded into os.environ so GUI picks up the same MONGODB_URI
# # # try:
# # #     # try python-dotenv first
# # #     from dotenv import load_dotenv
# # #     load_dotenv('.env.local')
# # # except Exception:
# # #     # fallback: simple .env.local parser (key=value, ignores # comments)
# # #     try:
# # #         env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
# # #         # also try repo root
# # #         if not os.path.exists(env_path):
# # #             env_path = os.path.join(os.path.dirname(__file__), '.env.local')
# # #         if os.path.exists(env_path):
# # #             with open(env_path, 'r', encoding='utf-8') as f:
# # #                 for line in f:
# # #                     line = line.strip()
# # #                     if not line or line.startswith('#'):
# # #                         continue
# # #                     if '=' in line:
# # #                         k, v = line.split('=', 1)
# # #                         k = k.strip()
# # #                         v = v.strip().strip('"').strip("'")
# # #                         if k and (k not in os.environ):
# # #                             os.environ[k] = v
# # #     except Exception:
# # #         pass
# # # from pymongo import MongoClient, errors
# # # from datetime import timezone
# # # import sys
# # # from datetime import datetime
# # # import calendar
# # # from collections import defaultdict
# # # import openpyxl
# # # from openpyxl.styles import PatternFill, Font, Alignment

# # # from PyQt6.QtWidgets import QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget, QLabel, QLineEdit, QTextEdit, QFileDialog, QComboBox
# # # from PyQt6.QtGui import QColor
# # # from PyQt6.QtCore import Qt

# # # class AttendanceTracker(QMainWindow):
# # #     def __init__(self):
# # #         super().__init__()
# # #         self.setWindowTitle("Employee Attendance Tracker")
# # #         self.setGeometry(100, 100, 600, 400)
        
# # #         self.central_widget = QWidget()
# # #         self.setCentralWidget(self.central_widget)
# # #         self.layout = QVBoxLayout(self.central_widget)
        
# # #         self.ip_label = QLabel("Device IP:")
# # #         self.layout.addWidget(self.ip_label)
# # #         self.ip_input = QLineEdit("192.168.1.250")
# # #         self.layout.addWidget(self.ip_input)
        
# # #         self.port_label = QLabel("Port:")
# # #         self.layout.addWidget(self.port_label)
# # #         self.port_input = QLineEdit("4370")
# # #         self.layout.addWidget(self.port_input)
        
# # #         self.password_label = QLabel("Password (Comm Key):")
# # #         self.layout.addWidget(self.password_label)
# # #         self.password_input = QLineEdit("0")
# # #         self.layout.addWidget(self.password_input)
        
# # #         self.month_label = QLabel("Select Month:")
# # #         self.layout.addWidget(self.month_label)
# # #         self.month_combo = QComboBox()
# # #         self.month_combo.addItem("No data available")
# # #         self.month_combo.setEnabled(False)
# # #         self.layout.addWidget(self.month_combo)
        
# # #         self.fetch_button = QPushButton("Fetch Data from Device")
# # #         self.fetch_button.clicked.connect(self.fetch_data)
# # #         self.layout.addWidget(self.fetch_button)
        
# # #         self.generate_button = QPushButton("Generate and Download Excel")
# # #         self.generate_button.clicked.connect(self.generate_excel)
# # #         self.layout.addWidget(self.generate_button)
        
# # #         # Live sync controls
# # #         self.start_sync_button = QPushButton("Start Live Sync")
# # #         self.start_sync_button.clicked.connect(self.start_live_sync)
# # #         self.layout.addWidget(self.start_sync_button)

# # #         self.stop_sync_button = QPushButton("Stop Live Sync")
# # #         self.stop_sync_button.clicked.connect(self.stop_live_sync)
# # #         self.stop_sync_button.setEnabled(False)
# # #         self.layout.addWidget(self.stop_sync_button)

# # #         self.status_label = QLabel("Status: Ready")
# # #         self.layout.addWidget(self.status_label)

# # #         self.log_text = QTextEdit()
# # #         self.log_text.setReadOnly(True)
# # #         self.layout.addWidget(self.log_text)

# # #         # Theme
# # #         self.set_style()

# # #         # MongoDB client (optional) - read from env if provided
# # #         try:
# # #             mongo_uri = "mongodb+srv://psitech:Psitech123@pms.ijqbdmu.mongodb.net"
# # #             mongo_db = "HMS"
# # #             coll_name = "attendance_logs"
# # #             self.mongo_client = MongoClient(mongo_uri)
# # #             self.mongo_db = self.mongo_client[mongo_db]
# # #             self.mongo_col = self.mongo_db[coll_name]
# # #             # create a dedupe unique index
# # #             try:
# # #                 self.mongo_col.create_index([('device_ip', 1), ('user_id', 1), ('timestamp_utc', 1)], unique=True)
# # #             except Exception:
# # #                 pass
# # #             self.log(f"MongoDB: connected to {mongo_db}/{coll_name}")
# # #         except Exception as e:
# # #             self.mongo_client = None
# # #             self.mongo_db = None
# # #             self.mongo_col = None
# # #             self.log(f"MongoDB not available: {e}")

# # #         # QTimer for live polling
# # #         from PyQt6.QtCore import QTimer
# # #         self.sync_timer = QTimer()
# # #         self.sync_timer.timeout.connect(self._live_sync_once)
# # #         self.sync_interval_ms = int(os.getenv('SYNC_INTERVAL_MS', '1000'))
    
# # #     def set_style(self):
# # #         qss = """
# # #         QMainWindow {
# # #             background-color: black;
# # #         }
# # #         QLabel {
# # #             color: orange;
# # #         }
# # #         QLineEdit {
# # #             background-color: #333333;
# # #             color: orange;
# # #             border: 1px solid orange;
# # #         }
# # #         QComboBox {
# # #             background-color: #333333;
# # #             color: orange;
# # #             border: 1px solid orange;
# # #         }
# # #         QComboBox QAbstractItemView {
# # #             background-color: #333333;
# # #             color: orange;
# # #             selection-background-color: #ff8c00;
# # #         }
# # #         QPushButton {
# # #             background-color: orange;
# # #             color: black;
# # #             border: none;
# # #             padding: 5px;
# # #         }
# # #         QPushButton:hover {
# # #             background-color: #ff8c00;
# # #         }
# # #         QTextEdit {
# # #             background-color: #333333;
# # #             color: orange;
# # #             border: 1px solid orange;
# # #         }
# # #         """
# # #         self.setStyleSheet(qss)
    
# # #     def log(self, message):
# # #         self.log_text.append(message)
# # #         self.status_label.setText(f"Status: {message}")
    
# # #     def fetch_data(self):
# # #         ip = self.ip_input.text()
# # #         try:
# # #             port = int(self.port_input.text())
# # #             password = int(self.password_input.text())
# # #         except ValueError:
# # #             self.log("Invalid port or password.")
# # #             return
        
# # #         self.log("Fetching data...")
# # #         try:
# # #             conn = None
# # #             zk = ZK(ip, port=port, timeout=5, password=password, force_udp=False, ommit_ping=False)
# # #             conn = zk.connect()
# # #             if not conn:
# # #                 raise RuntimeError("Unable to connect to device.")

# # #             conn.disable_device()  # Disable device to fetch data safely

# # #             self.users = conn.get_users()
# # #             self.user_map = {user.user_id: ((user.name or '').strip() or f"User {user.user_id}") for user in self.users}

# # #             self.attendances = conn.get_attendance()
            
# # #             # Collect orphan uids from attendances
# # #             for att in self.attendances:
# # #                 if att.user_id not in self.user_map:
# # #                     self.user_map[att.user_id] = f"Unknown {att.user_id}"
            
# # #             # Group by month, date, uid with list of (timestamp, punch)
# # #             self.att_by_month = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
# # #             for att in self.attendances:
# # #                 year_month = att.timestamp.strftime("%Y-%m")
# # #                 date = att.timestamp.date()
# # #                 uid = att.user_id
# # #                 punch = att.punch
# # #                 self.att_by_month[year_month][date][uid].append((att.timestamp, punch))
            
# # #             conn.enable_device()  # Re-enable device

# # #             # Insert fetched attendances into MongoDB (idempotent)
# # #             try:
# # #                 if self.mongo_col is not None and self.attendances:
# # #                     inserted = 0
# # #                     for att in self.attendances:
# # #                         try:
# # #                             ts = att.timestamp
# # #                             if ts.tzinfo is None:
# # #                                 ts_utc = ts.replace(tzinfo=timezone.utc).isoformat()
# # #                             else:
# # #                                 ts_utc = ts.astimezone(timezone.utc).isoformat()

# # #                             doc = {
# # #                                 'device_ip': ip,
# # #                                 'device_port': port,
# # #                                 'user_id': str(att.user_id),
# # #                                 'user_name': (getattr(att, 'name', None) or self.user_map.get(att.user_id) or f"User {att.user_id}"),
# # #                                 'timestamp_utc': ts_utc,
# # #                                 'punch': int(getattr(att, 'punch', getattr(att, 'punch', 0))),
# # #                                 'raw': {
# # #                                     'timestamp': str(att.timestamp),
# # #                                     'punch': getattr(att, 'punch', None),
# # #                                 },
# # #                                 'ingested_at_utc': datetime.now(timezone.utc).isoformat(),
# # #                             }
# # #                             try:
# # #                                 self.mongo_col.insert_one(doc)
# # #                                 inserted += 1
# # #                             except errors.DuplicateKeyError:
# # #                                 # already exists
# # #                                 pass
# # #                         except Exception as ie:
# # #                             # continue on individual record error
# # #                             self.log(f"Insert error: {ie}")
# # #                     self.log(f"Inserted {inserted} attendance records into DB")
# # #             except Exception as dbe:
# # #                 self.log(f"DB insertion error: {dbe}")
            
# # #             # Update month dropdown
# # #             self.month_combo.clear()
# # #             if self.att_by_month:
# # #                 months = sorted(self.att_by_month.keys())
# # #                 self.month_combo.addItems(months)
# # #                 self.month_combo.setEnabled(True)
# # #                 self.log("Data fetched successfully. Months available: " + ", ".join(months))
# # #             else:
# # #                 self.month_combo.addItem("No data available")
# # #                 self.month_combo.setEnabled(False)
# # #                 self.log("Data fetched successfully, but no attendance records found.")
# # #         except Exception as e:
# # #             self.month_combo.clear()
# # #             self.month_combo.addItem("No data available")
# # #             self.month_combo.setEnabled(False)
# # #             self.log(f"Error: {str(e)}")
# # #         finally:
# # #             if conn:
# # #                 conn.disconnect()

# # #     # Live sync helpers
# # #     def start_live_sync(self):
# # #         if self.sync_timer.isActive():
# # #             return
# # #         self.sync_timer.start(self.sync_interval_ms)
# # #         self.start_sync_button.setEnabled(False)
# # #         self.stop_sync_button.setEnabled(True)
# # #         self.log("Live sync started")

# # #     def stop_live_sync(self):
# # #         if self.sync_timer.isActive():
# # #             self.sync_timer.stop()
# # #         self.start_sync_button.setEnabled(True)
# # #         self.stop_sync_button.setEnabled(False)
# # #         self.log("Live sync stopped")

# # #     def _live_sync_once(self):
# # #         # perform a lightweight connect, fetch attendance, insert to DB, disconnect
# # #         ip = self.ip_input.text()
# # #         try:
# # #             port = int(self.port_input.text())
# # #             password = int(self.password_input.text())
# # #         except ValueError:
# # #             self.log("Invalid port or password for live sync.")
# # #             return
# # #         try:
# # #             zk = ZK(ip, port=port, timeout=5, password=password, force_udp=False, ommit_ping=False)
# # #             conn = zk.connect()
# # #             if not conn:
# # #                 self.log("Live sync: unable to connect")
# # #                 return
# # #             # conn.disable_device()
# # #             atts = conn.get_attendance()
# # #             users = conn.get_users()
# # #             user_map = {user.user_id: ((user.name or '').strip() or f"User {user.user_id}") for user in users}
# # #             # insert into DB
# # #             if self.mongo_col is not None and atts:
# # #                 inserted = 0
# # #                 for att in atts:
# # #                     try:
# # #                         ts = att.timestamp
# # #                         if ts.tzinfo is None:
# # #                             ts_utc = ts.replace(tzinfo=timezone.utc).isoformat()
# # #                         else:
# # #                             ts_utc = ts.astimezone(timezone.utc).isoformat()
# # #                         doc = {
# # #                             'device_ip': ip,
# # #                             'device_port': port,
# # #                             'user_id': str(att.user_id),
# # #                             'user_name': user_map.get(att.user_id) or f"User {att.user_id}",
# # #                             'timestamp_utc': ts_utc,
# # #                             'punch': int(getattr(att, 'punch', 0)),
# # #                             'raw': {'timestamp': str(att.timestamp), 'punch': getattr(att, 'punch', None)},
# # #                             'ingested_at_utc': datetime.now(timezone.utc).isoformat(),
# # #                         }
# # #                         try:
# # #                             self.mongo_col.insert_one(doc)
# # #                             inserted += 1
# # #                         except errors.DuplicateKeyError:
# # #                             pass
# # #                     except Exception as ie:
# # #                         self.log(f"Live insert error: {ie}")
# # #                 if inserted:
# # #                     self.log(f"Live sync inserted {inserted} records")
# # #             # conn.enable_device()
# # #             conn.disconnect()
# # #         except Exception as e:
# # #             self.log(f"Live sync error: {e}")
    
# # #     def generate_excel(self):
# # #         if not hasattr(self, 'att_by_month') or not self.att_by_month:
# # #             self.log("Fetch data first or no data available.")
# # #             return

# # #         selected_month = self.month_combo.currentText()
# # #         if selected_month == "No data available" or selected_month not in self.att_by_month:
# # #             self.log("No month selected or no data available.")
# # #             return

# # #         import openpyxl
# # #         from openpyxl.styles import PatternFill, Font, Alignment

# # #         IN_PUNCHES = {0, 3, 4}
# # #         OUT_PUNCHES = {1, 2, 5}

# # #         def minutes_to_hhmm(total_minutes: int) -> str:
# # #             hours = total_minutes // 60
# # #             mins = total_minutes % 60
# # #             return f"{hours}:{mins:02d}"

# # #         def compute_daily_minutes(records):
# # #             if not records:
# # #                 return 0
# # #             has_in = any(p in IN_PUNCHES for _, p in records)
# # #             has_out = any(p in OUT_PUNCHES for _, p in records)
# # #             if not has_in and not has_out:
# # #                 return 0
# # #             if has_in and not has_out:
# # #                 return 9 * 60
# # #             recs_sorted = sorted(records, key=lambda x: x[0])
# # #             current_in = None
# # #             total_min = 0
# # #             for ts, p in recs_sorted:
# # #                 if p in IN_PUNCHES:
# # #                     current_in = ts
# # #                 elif p in OUT_PUNCHES:
# # #                     if current_in is not None:
# # #                         delta = int((ts - current_in).total_seconds() // 60)
# # #                         if delta > 0:
# # #                             total_min += delta
# # #                         current_in = None
# # #             return total_min

# # #         # Create workbook
# # #         wb = openpyxl.Workbook()
# # #         wb.remove(wb.active)

# # #         # All users sorted
# # #         user_list = sorted(self.user_map.items(), key=lambda x: x[1])

# # #         # Create only the selected month sheet
# # #         ws = wb.create_sheet(title=selected_month)
# # #         year, month = map(int, selected_month.split('-'))
# # #         import calendar
# # #         _, num_days = calendar.monthrange(year, month)

# # #         # Headers
# # #         ws['A1'] = "Name"
# # #         ws['A1'].font = Font(bold=True, color="FFFFFF")
# # #         ws['A1'].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
# # #         ws['A1'].alignment = Alignment(horizontal="center")

# # #         for day in range(1, num_days + 1):
# # #             col = openpyxl.utils.get_column_letter(day + 1)
# # #             ws[f"{col}1"] = day
# # #             ws[f"{col}1"].font = Font(bold=True, color="FFFFFF")
# # #             ws[f"{col}1"].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
# # #             ws[f"{col}1"].alignment = Alignment(horizontal="center")

# # #         # Add Total column header
# # #         total_col_letter = openpyxl.utils.get_column_letter(num_days + 2)
# # #         ws[f"{total_col_letter}1"] = "Total"
# # #         ws[f"{total_col_letter}1"].font = Font(bold=True, color="FFFFFF")
# # #         ws[f"{total_col_letter}1"].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
# # #         ws[f"{total_col_letter}1"].alignment = Alignment(horizontal="center")

# # #         ws.freeze_panes = "B2"

# # #         # Data rows
# # #         row = 2
# # #         for uid, name in user_list:
# # #             ws[f"A{row}"] = name
# # #             ws[f"A{row}"].font = Font(color="000000")

# # #             monthly_total_minutes = 0

# # #             for day in range(1, num_days + 1):
# # #                 date_obj = datetime(year, month, day).date()
# # #                 col = openpyxl.utils.get_column_letter(day + 1)

# # #                 records = self.att_by_month[selected_month].get(date_obj, {}).get(uid, [])
# # #                 ins = sorted([ts for ts, p in records if p in IN_PUNCHES])
# # #                 outs = sorted([ts for ts, p in records if p in OUT_PUNCHES])

# # #                 has_in = bool(ins)
# # #                 has_out = bool(outs)

# # #                 if has_in and has_out:
# # #                     status = "P"
# # #                     fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")
# # #                 elif has_in or has_out:
# # #                     status = "HD"
# # #                     fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
# # #                 else:
# # #                     status = "A"
# # #                     fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")

# # #                 daily_minutes = compute_daily_minutes(records)
# # #                 monthly_total_minutes += daily_minutes

# # #                 first_in_txt = ins[0].time().strftime("%H:%M") if has_in else "-"
# # #                 last_out_txt = outs[-1].time().strftime("%H:%M") if has_out else "-"
# # #                 hrs_txt = minutes_to_hhmm(daily_minutes)

# # #                 cell_value = f"{status}\nIn: {first_in_txt}\nOut: {last_out_txt}\nHrs: {hrs_txt}"
# # #                 ws[f"{col}{row}"] = cell_value
# # #                 ws[f"{col}{row}"].fill = fill
# # #                 ws[f"{col}{row}"].alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
# # #                 ws[f"{col}{row}"].font = Font(color="000000")

# # #             ws[f"{total_col_letter}{row}"] = minutes_to_hhmm(monthly_total_minutes)
# # #             ws[f"{total_col_letter}{row}"].alignment = Alignment(horizontal="center", vertical="center")
# # #             ws[f"{total_col_letter}{row}"].font = Font(bold=True, color="000000")

# # #             row += 1

# # #         # Adjust formatting
# # #         ws.column_dimensions['A'].width = 20
# # #         for day in range(1, num_days + 1):
# # #             col_letter = openpyxl.utils.get_column_letter(day + 1)
# # #             ws.column_dimensions[col_letter].width = 14
# # #         ws.column_dimensions[total_col_letter].width = 12

# # #         for r in range(2, row):
# # #             ws.row_dimensions[r].height = 48

# # #         # Save dialog
# # #         file_path, _ = QFileDialog.getSaveFileName(self, "Save Excel", f"Attendance_Report_{selected_month}.xlsx", "Excel Files (*.xlsx)")
# # #         if file_path:
# # #             wb.save(file_path)
# # #             self.log(f"Excel saved to {file_path}")
# # #         else:
# # #             self.log("Save cancelled.")


# # # if __name__ == "__main__":
# # #     app = QApplication(sys.argv)
# # #     window = AttendanceTracker()
# # #     window.show()
# # #     sys.exit(app.exec())



















# import os
# from zk import ZK, const

# from pymongo import MongoClient, errors
# from datetime import timezone, datetime
# from collections import defaultdict

# import openpyxl
# from openpyxl.styles import PatternFill, Font, Alignment

# from PyQt6.QtWidgets import (
#     QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget,
#     QLabel, QLineEdit, QTextEdit, QFileDialog, QComboBox, QPlainTextEdit, QHBoxLayout
# )
# from PyQt6.QtCore import Qt, QTimer


# def minutes_to_hhmm(total_minutes: int) -> str:
#     hours = total_minutes // 60
#     mins = total_minutes % 60
#     return f"{hours}:{mins:02d}"


# class AttendanceTracker(QMainWindow):
#     """
#     Multi-device, per-organisation attendance sync + export tool.

#     - Devices: one per line in "ip[,port[,password]]" format (defaults 4370, 0)
#     - MongoDB: hardcoded URI; DB is FIXED to 'HMS'
#     - Collection: <ORG_PREFIX>_attendance_logs (unique index: device_ip,user_id,timestamp_utc)
#     - Organisation prefix is applied ONLY when you click the "Set" button.
#     """
#     def __init__(self):
#         super().__init__()
#         self.setWindowTitle("Hostel Attendance Tracker Configuration Panel")
#         self.setGeometry(100, 100, 820, 680)

#         self.central_widget = QWidget()
#         self.setCentralWidget(self.central_widget)
#         root = QVBoxLayout(self.central_widget)

#         # --- Org / Collection prefix row (with 'Set' button) ---
#         org_row = QHBoxLayout()
#         self.org_label = QLabel("Hostel Name:")
#         self.org_input = QLineEdit("")  # type full name first
#         self.org_set_btn = QPushButton("Set")
#         self.org_set_btn.clicked.connect(self._apply_org_clicked)
#         org_row.addWidget(self.org_label)
#         org_row.addWidget(self.org_input)
#         org_row.addWidget(self.org_set_btn)
#         root.addLayout(org_row)

#         # Active collection indicator
#         self.active_coll_label = QLabel("Active collection: (not set)")
#         root.addWidget(self.active_coll_label)

#         # --- Devices list (multi-line) ---
#         self.devices_label = QLabel("Devices (one per line: ip[,port[,password]]):")
#         root.addWidget(self.devices_label)
#         self.devices_input = QPlainTextEdit()
#         self.devices_input.setPlaceholderText(
#             "Example:\n"
#             "192.168.1.250\n"
#             "192.168.1.251,4370\n"
#             "192.168.1.252,4370,0"
#         )
#         self.devices_input.setPlainText("192.168.1.250,4370,0")
#         root.addWidget(self.devices_input)

#         # --- Month dropdown ---
#         self.month_label = QLabel("Select Month:")
#         root.addWidget(self.month_label)
#         self.month_combo = QComboBox()
#         self.month_combo.addItem("No data available")
#         self.month_combo.setEnabled(False)
#         root.addWidget(self.month_combo)

#         # --- Buttons ---
#         self.fetch_button = QPushButton("Fetch Data from Devices")
#         self.fetch_button.clicked.connect(self.fetch_data)
#         root.addWidget(self.fetch_button)

#         self.generate_button = QPushButton("Generate and Download Excel")
#         self.generate_button.clicked.connect(self.generate_excel)
#         root.addWidget(self.generate_button)

#         # Live sync controls
#         self.start_sync_button = QPushButton("Start Live Sync (all devices)")
#         self.start_sync_button.clicked.connect(self.start_live_sync)
#         root.addWidget(self.start_sync_button)

#         self.stop_sync_button = QPushButton("Stop Live Sync")
#         self.stop_sync_button.clicked.connect(self.stop_live_sync)
#         self.stop_sync_button.setEnabled(False)
#         root.addWidget(self.stop_sync_button)

#         # Status + logs
#         self.status_label = QLabel("Status: Ready")
#         root.addWidget(self.status_label)

#         self.log_text = QTextEdit()
#         self.log_text.setReadOnly(True)
#         root.addWidget(self.log_text)

#         # Theme
#         self.set_style()

#         # --- Mongo: hardcoded URI; DB fixed to 'HMS'; collection depends on org prefix ---
#         self.mongo_uri = "mongodb+srv://psitech:Psitech123@pms.ijqbdmu.mongodb.net"
#         self.mongo_client = None
#         self.mongo_db = None
#         self.mongo_col = None
#         self.current_coll_name = None  # track to avoid thrashing

#         # Default to placeholder org until user clicks Set
#         self._ensure_mongo(coll_name=self._collection_name("ORG"))

#         # For in-memory data (across multiple devices)
#         self.user_map = {}              # global user_id -> name (best effort)
#         self.att_by_month = {}          # month -> date -> uid -> [(ts, punch), ...]
#         self.last_ts_per_device = {}    # device_ip -> last UTC datetime seen (watermark for live poll)

#         # QTimer for live polling over multiple devices
#         self.sync_timer = QTimer()
#         self.sync_timer.timeout.connect(self._live_sync_once_all_devices)
#         self.sync_interval_ms = int(os.getenv('SYNC_INTERVAL_MS', '1000'))

#     # ---------------- UI helpers ----------------
#     def set_style(self):
#         qss = """
#         QMainWindow { background-color: black; }
#         QLabel { color: orange; }
#         QLineEdit, QPlainTextEdit {
#             background-color: #333333; color: orange; border: 1px solid orange;
#         }
#         QComboBox {
#             background-color: #333333; color: orange; border: 1px solid orange;
#         }
#         QComboBox QAbstractItemView {
#             background-color: #333333; color: orange; selection-background-color: #ff8c00;
#         }
#         QPushButton {
#             background-color: orange; color: black; border: none; padding: 6px;
#         }
#         QPushButton:hover { background-color: #ff8c00; }
#         QTextEdit {
#             background-color: #333333; color: orange; border: 1px solid orange;
#         }
#         """
#         self.setStyleSheet(qss)

#     def log(self, message):
#         self.log_text.append(message)
#         self.status_label.setText(f"Status: {message}")

#     # ---------------- Org/Collection helpers ----------------
#     def _sanitize_org(self, org: str) -> str:
#         # Replace spaces with underscores, keep alnum + underscore, replace others with underscore
#         org = (org or "ORG").strip().replace(" ", "_")
#         return "".join(ch if (ch.isalnum() or ch == "_") else "_" for ch in org)

#     def _collection_name(self, org: str) -> str:
#         return f"{self._sanitize_org(org)}_attendance_logs"

#     def _apply_org_clicked(self):
#         org_text = self.org_input.text().strip() or "ORG"
#         coll_name = self._collection_name(org_text)
#         self._ensure_mongo(coll_name=coll_name)

#     # ---------------- Mongo helpers ----------------
#     def _ensure_mongo(self, coll_name: str):
#         """(Re)connect Mongo using FIXED DB 'HMS' and the given collection name."""
#         if self.current_coll_name == coll_name and self.mongo_client is not None:
#             # Already connected to the desired collection; nothing to do.
#             self.log(f"MongoDB: already on HMS/{coll_name}")
#             self.active_coll_label.setText(f"Active collection: {coll_name}")
#             return

#         # Close any previous client
#         # try:
#         #     if self.mongo_client:
#         #         self.mongo_client.close()
#         # except Exception:
#         #     pass

#         try:
#             if self.mongo_client is not None:
#                 self.mongo_client.close()
#         except Exception:
#             pass

#         try:
#             self.mongo_client = MongoClient(self.mongo_uri)
#             # DB is fixed
#             self.mongo_db = self.mongo_client["HMS"]
#             # Collection depends on org prefix
#             self.mongo_col = self.mongo_db[coll_name]
#             # unique index for idempotency across devices
#             try:
#                 self.mongo_col.create_index(
#                     [('device_ip', 1), ('user_id', 1), ('timestamp_utc', 1)],
#                     unique=True
#                 )
#             except Exception:
#                 pass
#             self.current_coll_name = coll_name
#             self.active_coll_label.setText(f"Active collection: {coll_name}")
#             self.log(f"MongoDB: connected to HMS/{coll_name}")
#         except Exception as e:
#             self.mongo_client = None
#             self.mongo_db = None
#             self.mongo_col = None
#             self.current_coll_name = None
#             self.active_coll_label.setText("Active collection: (error)")
#             self.log(f"MongoDB not available: {e}")

#     # ---------------- Device parsing ----------------
#     def _parse_devices(self):
#         """
#         Reads the devices box and yields tuples of (ip, port, password).
#         Defaults: port=4370, password=0
#         Skips blank and commented lines (#).
#         """
#         devices = []
#         text = self.devices_input.toPlainText().strip()
#         if not text:
#             return devices
#         for line in text.splitlines():
#             line = line.strip()
#             if not line or line.startswith("#"):
#                 continue
#             parts = [p.strip() for p in line.split(",")]
#             ip = parts[0]
#             port = int(parts[1]) if len(parts) >= 2 and parts[1] else 4370
#             password = int(parts[2]) if len(parts) >= 3 and parts[2] else 0
#             devices.append((ip, port, password))
#         return devices

#     # ---------------- Snapshot fetch across all devices ----------------
#     def fetch_data(self):
#         devices = self._parse_devices()
#         if not devices:
#             self.log("No devices configured.")
#             return

#         self.log("Fetching data from all devices...")
#         # Reset in-memory structures
#         self.att_by_month = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
#         self.user_map = {}

#         total_inserted = 0
#         for (ip, port, password) in devices:
#             try:
#                 zk = ZK(ip, port=port, timeout=5, password=password, force_udp=False, ommit_ping=False)
#                 conn = zk.connect()
#                 if not conn:
#                     raise RuntimeError(f"Unable to connect to device {ip}")

#                 # bulk mode to avoid mid-read changes
#                 conn.disable_device()

#                 # users + attendance
#                 users = conn.get_users() or []
#                 atts = conn.get_attendance() or []

#                 # build/merge user map
#                 local_user_map = {u.user_id: ((u.name or '').strip() or f"User {u.user_id}") for u in users}
#                 self.user_map.update(local_user_map)

#                 # ensure all referenced user_ids have a name
#                 for att in atts:
#                     if att.user_id not in self.user_map:
#                         self.user_map[att.user_id] = f"Unknown {att.user_id}"

#                 # group by month/date/uid
#                 for att in atts:
#                     year_month = att.timestamp.strftime("%Y-%m")
#                     date = att.timestamp.date()
#                     uid = att.user_id
#                     punch = att.punch
#                     self.att_by_month[year_month][date][uid].append((att.timestamp, punch))

#                 # insert to Mongo
#                 inserted = self._insert_records(ip, port, atts, self.user_map)
#                 total_inserted += inserted

#                 # watermark for live sync per device
#                 if atts:
#                     mx_dt = max(self._as_utc_dt(a.timestamp) for a in atts)
#                     self.last_ts_per_device[ip] = mx_dt

#                 conn.enable_device()
#                 conn.disconnect()
#                 self.log(f"[{ip}] fetched {len(atts)} records, inserted {inserted}")
#             except Exception as e:
#                 self.log(f"[{ip}] fetch error: {e}")

#         # update months dropdown
#         self.month_combo.clear()
#         if self.att_by_month:
#             months = sorted(self.att_by_month.keys())
#             self.month_combo.addItems(months)
#             self.month_combo.setEnabled(True)
#             self.log(f"Fetch complete. Months: {', '.join(months)} | Inserted total: {total_inserted}")
#         else:
#             self.month_combo.addItem("No data available")
#             self.month_combo.setEnabled(False)
#             self.log("Fetch completed, no attendance records found.")

#     # ---------------- Live sync (poll all devices in a loop) ----------------
#     def start_live_sync(self):
#         if self.sync_timer.isActive():
#             return
#         self.sync_timer.start(self.sync_interval_ms)
#         self.start_sync_button.setEnabled(False)
#         self.stop_sync_button.setEnabled(True)
#         self.log("Live sync started (multi-device polling)")

#     def stop_live_sync(self):
#         if self.sync_timer.isActive():
#             self.sync_timer.stop()
#         self.start_sync_button.setEnabled(True)
#         self.stop_sync_button.setEnabled(False)
#         self.log("Live sync stopped")

#     def _live_sync_once_all_devices(self):
#         devices = self._parse_devices()
#         if not devices:
#             self.log("Live sync: no devices configured.")
#             return

#         for (ip, port, password) in devices:
#             try:
#                 zk = ZK(ip, port=port, timeout=5, password=password, force_udp=False, ommit_ping=False)
#                 conn = zk.connect()
#                 if not conn:
#                     self.log(f"Live sync: unable to connect {ip}")
#                     continue

#                 # Realtime is device/SDK dependent. We keep lightweight polling:
#                 atts = conn.get_attendance() or []
#                 conn.disconnect()

#                 # filter strictly newer than last watermark
#                 fresh = self._filter_new_events(ip, atts)

#                 if fresh:
#                     # refresh users best-effort (cheap; if it fails, use old map)
#                     name_map = self._try_get_user_map(ip, port, password) or self.user_map
#                     ins = self._insert_records(ip, port, fresh, name_map)
#                     if ins:
#                         self.log(f"[{ip}] Live inserted {ins} new record(s)")
#                         # advance watermark
#                         mx_dt = max(self._as_utc_dt(a.timestamp) for a in fresh)
#                         self.last_ts_per_device[ip] = mx_dt
#             except Exception as e:
#                 self.log(f"[{ip}] Live sync error: {e}")

#     # ---------------- Helpers: DB insert / watermark / users ----------------
#     def _insert_records(self, ip, port, atts, user_map):
#         if self.mongo_col is None or not atts:
#             return 0
#         inserted = 0
#         for att in atts:
#             try:
#                 ts = att.timestamp
#                 ts_utc = (ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts.astimezone(timezone.utc)).isoformat()
#                 doc = {
#                     'device_ip': ip,
#                     'device_port': port,
#                     'user_id': str(att.user_id),
#                     'user_name': user_map.get(att.user_id) or f"User {att.user_id}",
#                     'timestamp_utc': ts_utc,
#                     'punch': int(getattr(att, 'punch', 0)),
#                     'raw': {'timestamp': str(att.timestamp), 'punch': getattr(att, 'punch', None)},
#                     'ingested_at_utc': datetime.now(timezone.utc).isoformat(),
#                 }
#                 try:
#                     self.mongo_col.insert_one(doc)
#                     inserted += 1
#                 except errors.DuplicateKeyError:
#                     pass
#             except Exception as ie:
#                 self.log(f"Insert error: {ie}")
#         return inserted

#     def _as_utc_dt(self, dt):
#         return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)

#     def _filter_new_events(self, ip, atts):
#         if not atts:
#             return []
#         last = self.last_ts_per_device.get(ip)
#         if not last:
#             return atts
#         fresh = []
#         for a in atts:
#             if self._as_utc_dt(a.timestamp) > last:
#                 fresh.append(a)
#         return fresh

#     def _try_get_user_map(self, ip, port, password):
#         try:
#             zk = ZK(ip, port=port, timeout=5, password=password, force_udp=False, ommit_ping=False)
#             conn = zk.connect()
#             if not conn:
#                 return None
#             users = conn.get_users() or []
#             conn.disconnect()
#             um = {u.user_id: ((u.name or '').strip() or f"User {u.user_id}") for u in users}
#             # also merge into global map for Excel
#             self.user_map.update(um)
#             return um
#         except Exception:
#             return None

#     # ---------------- Excel export (aggregated across devices) ----------------
#     def generate_excel(self):
#         if not hasattr(self, 'att_by_month') or not self.att_by_month:
#             self.log("Fetch data first or no data available.")
#             return

#         selected_month = self.month_combo.currentText()
#         if selected_month == "No data available" or selected_month not in self.att_by_month:
#             self.log("No month selected or no data available.")
#             return

#         IN_PUNCHES = {0, 3, 4}
#         OUT_PUNCHES = {1, 2, 5}

#         def compute_daily_minutes(records):
#             if not records:
#                 return 0
#             has_in = any(p in IN_PUNCHES for _, p in records)
#             has_out = any(p in OUT_PUNCHES for _, p in records)
#             if not has_in and not has_out:
#                 return 0
#             if has_in and not has_out:
#                 return 9 * 60
#             recs_sorted = sorted(records, key=lambda x: x[0])
#             current_in = None
#             total_min = 0
#             for ts, p in recs_sorted:
#                 if p in IN_PUNCHES:
#                     current_in = ts
#                 elif p in OUT_PUNCHES:
#                     if current_in is not None:
#                         delta = int((ts - current_in).total_seconds() // 60)
#                         if delta > 0:
#                             total_min += delta
#                         current_in = None
#             return total_min

#         # Workbook
#         wb = openpyxl.Workbook()
#         wb.remove(wb.active)

#         # All users sorted (across devices)
#         user_list = sorted(self.user_map.items(), key=lambda x: x[1])

#         ws = wb.create_sheet(title=selected_month)
#         year, month = map(int, selected_month.split('-'))
#         import calendar
#         _, num_days = calendar.monthrange(year, month)

#         # Headers
#         ws['A1'] = "Name"
#         ws['A1'].font = Font(bold=True, color="FFFFFF")
#         ws['A1'].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
#         ws['A1'].alignment = Alignment(horizontal="center")

#         for day in range(1, num_days + 1):
#             col = openpyxl.utils.get_column_letter(day + 1)
#             ws[f"{col}1"] = day
#             ws[f"{col}1"].font = Font(bold=True, color="FFFFFF")
#             ws[f"{col}1"].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
#             ws[f"{col}1"].alignment = Alignment(horizontal="center")

#         total_col_letter = openpyxl.utils.get_column_letter(num_days + 2)
#         ws[f"{total_col_letter}1"] = "Total"
#         ws[f"{total_col_letter}1"].font = Font(bold=True, color="FFFFFF")
#         ws[f"{total_col_letter}1"].fill = PatternFill(start_color="FF8C00", end_color="FF8C00", fill_type="solid")
#         ws[f"{total_col_letter}1"].alignment = Alignment(horizontal="center")
#         ws.freeze_panes = "B2"

#         # Rows
#         row = 2
#         for uid, name in user_list:
#             ws[f"A{row}"] = name
#             ws[f"A{row}"].font = Font(color="000000")

#             monthly_total_minutes = 0

#             for day in range(1, num_days + 1):
#                 date_obj = datetime(year, month, day).date()
#                 col = openpyxl.utils.get_column_letter(day + 1)

#                 records = self.att_by_month[selected_month].get(date_obj, {}).get(uid, [])
#                 ins = sorted([ts for ts, p in records if p in IN_PUNCHES])
#                 outs = sorted([ts for ts, p in records if p in OUT_PUNCHES])

#                 has_in = bool(ins)
#                 has_out = bool(outs)

#                 if has_in and has_out:
#                     status = "P"
#                     fill = PatternFill(start_color="00FF00", end_color="00FF00", fill_type="solid")
#                 elif has_in or has_out:
#                     status = "HD"
#                     fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
#                 else:
#                     status = "A"
#                     fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")

#                 daily_minutes = compute_daily_minutes(records)
#                 monthly_total_minutes += daily_minutes

#                 first_in_txt = ins[0].time().strftime("%H:%M") if has_in else "-"
#                 last_out_txt = outs[-1].time().strftime("%H:%M") if has_out else "-"
#                 hrs_txt = minutes_to_hhmm(daily_minutes)

#                 cell_value = f"{status}\nIn: {first_in_txt}\nOut: {last_out_txt}\nHrs: {hrs_txt}"
#                 ws[f"{col}{row}"] = cell_value
#                 ws[f"{col}{row}"].fill = fill
#                 ws[f"{col}{row}"].alignment = Alignment(horizontal="center", vertical="top", wrap_text=True)
#                 ws[f"{col}{row}"].font = Font(color="000000")

#             ws[f"{total_col_letter}{row}"] = minutes_to_hhmm(monthly_total_minutes)
#             ws[f"{total_col_letter}{row}"].alignment = Alignment(horizontal="center", vertical="center")
#             ws[f"{total_col_letter}{row}"].font = Font(bold=True, color="000000")

#             row += 1

#         # Formatting
#         ws.column_dimensions['A'].width = 22
#         for day in range(1, num_days + 1):
#             col_letter = openpyxl.utils.get_column_letter(day + 1)
#             ws.column_dimensions[col_letter].width = 14
#         ws.column_dimensions[total_col_letter].width = 12
#         for r in range(2, row):
#             ws.row_dimensions[r].height = 48

#         # Save dialog
#         file_path, _ = QFileDialog.getSaveFileName(self, "Save Excel", f"Attendance_Report_{selected_month}.xlsx", "Excel Files (*.xlsx)")
#         if file_path:
#             wb.save(file_path)
#             self.log(f"Excel saved to {file_path}")
#         else:
#             self.log("Save cancelled.")


# if __name__ == "__main__":
#     app = QApplication(os.sys.argv)
#     window = AttendanceTracker()
#     window.show()
#     os.sys.exit(app.exec())
