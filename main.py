# --- CONFIGURATION VARIABLES ---
LED_COUNT = 30           # Total number of WS2812B LEDs on your strip
SIGNAL_PIN = DigitalPin.P8  # Configured MakeCode Python Pin Syntax
DELAY_MS = 15            # Speed of the breath (lower number = faster breath)
MAX_BRIGHTNESS = 255     # Peak brightness limit (0 to 255)
MIN_BRIGHTNESS = 0       # Lowest brightness limit (0 to 255)

# --- HEART RATE SENSOR SETUP (PIN 1) ---
SENSOR_PIN = AnalogPin.P1   # Connect KY-039 Signal (S) to P1 on Robotbit
SAMPLE_DELAY_MS = 20        # Safe 50Hz hardware sampling interval
RAW_BASELINE = 317          # Fixed directly to your stable hardware reading
TRIGGER_DELTA = 6           # 2% spike detection line (317 * 0.02 approx 6)

# --- STATE VARIABLES ---
is_breathing = False     # Tracks if the lights should be animating or off
bpm = 55                    # Starts at a safe default under the 60 BPM trigger limit
is_peak = False
loop_counter = 0            # Track time steps safely as plain integers

# --- INITIALIZATION ---
# Initialize the light strip
strip = neopixel.create(SIGNAL_PIN, LED_COUNT, NeoPixelMode.RGB)
strip.clear()
strip.show()

# Ensure Robotbit fan motor is completely off at start
robotbit.motor_run(robotbit.Motors.M2A, 0)
# Silence any sounds at startup
music.stop_all_sounds()

def stop_everything():
    global is_breathing, bpm
    is_breathing = False
    # Stop the light strip completely
    strip.clear()
    strip.show()
    # Shut down the motor on M2 port completely
    robotbit.motor_run(robotbit.Motors.M2A, 0)
    # Stop the micro:bit speaker audio immediately
    music.stop_all_sounds()
    bpm = 55  # Safe buffer reset so the sensor won't instantly re-trigger upon shutoff

def on_forever():
    global is_breathing, bpm, is_peak, loop_counter
    
    # 1. READ RAW ANALOG VOLTAGE (Your verified sensor code)
    raw_input_value = pins.analog_read_pin(SENSOR_PIN)
    loop_counter += 1
    
    # Isolate voltage change
    pulse_change = raw_input_value - RAW_BASELINE
    if pulse_change < 0:
        pulse_change = 0

    # 2. CRASH-SAFE TIMING DETECTION LOGIC (Your verified sensor code)
    if pulse_change > TRIGGER_DELTA:
        if not is_peak:
            # Convert loop counts to a real millisecond value (Loops * 20ms)
            time_gap_ms = loop_counter * SAMPLE_DELAY_MS
            loop_counter = 0   # Clear count immediately for the next wave
            is_peak = True
            
            # Filter window: Only calculate if pulse is between 40 and 140 BPM
            if time_gap_ms > 420 and time_gap_ms < 1500:
                calculated_heart_rate = 60000 // time_gap_ms
                # Smooth out jumps using a stable integer-based rolling average
                bpm = ((bpm * 8) + (calculated_heart_rate * 2)) // 10
            
            basic.show_icon(IconNames.HEART)
    else:
        # If the wave drops below half the trigger line, unlock for the next beat
        if pulse_change < (TRIGGER_DELTA // 2):
            is_peak = False
        basic.show_icon(IconNames.SMALL_HEART)
        
    # Data logging output stream
    serial.write_value("RAW_INPUT", raw_input_value)
    serial.write_value("PULSE_SPIKE", pulse_change)
    serial.write_value("LIVE_BPM", bpm)

    # 3. COMBINED DUO TRIGGER (BUTTON A PRESS OR SENSOR BPM > 60)
    if (input.button_is_pressed(Button.A) or bpm > 60) and not is_breathing:
        is_breathing = True
        # Spin up the motor on M2 port at full speed (255)
        robotbit.motor_run(robotbit.Motors.M2A, 255)
        
        # Set tempo to a very slow, calm 50 Beats Per Minute
        music.set_tempo(50)
        # Using a valid melody from the official MakeCode list
        music.begin_melody(music.built_in_melody(Melodies.ENTERTAINER), MelodyOptions.FOREVER_IN_BACKGROUND)
        basic.pause(500)

    # Check if Button B was clicked to call the stop function
    if input.button_is_pressed(Button.B):
        stop_everything()
        basic.pause(500)

    # 4. LIGHT STRIP BREATHING ROUTINE
    if is_breathing:
        
        # 1. FADE UP TO WHITE
        for brightness in range(MIN_BRIGHTNESS, MAX_BRIGHTNESS + 1):
            # Check Button B inside the loop for an instant emergency cutoff
            if input.button_is_pressed(Button.B):
                stop_everything()
                break
            # Hardware-level color value scaling to avoid MakeCode brightness lock
            strip.show_color(neopixel.rgb(brightness, brightness, brightness))
            basic.pause(DELAY_MS)

        # Double check state before starting the fade down loop
        if is_breathing:
            # 2. FADE DOWN TO DARK
            for brightness2 in range(MIN_BRIGHTNESS, MAX_BRIGHTNESS + 1):
                # Check Button B inside the loop for an instant emergency cutoff
                if input.button_is_pressed(Button.B):
                    stop_everything()
                    break
                current_dim_value = MAX_BRIGHTNESS - brightness2
                # Hardware-level color value scaling to avoid MakeCode brightness lock
                strip.show_color(neopixel.rgb(current_dim_value, current_dim_value, current_dim_value))
                basic.pause(DELAY_MS)
                
    basic.pause(10)

basic.forever(on_forever)
