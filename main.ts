//  --- CONFIGURATION VARIABLES ---
let LED_COUNT = 30
//  Total number of WS2812B LEDs on your strip
let SIGNAL_PIN = DigitalPin.P8
//  Configured MakeCode Python Pin Syntax
let DELAY_MS = 15
//  Speed of the breath (lower number = faster breath)
let MAX_BRIGHTNESS = 255
//  Peak brightness limit (0 to 255)
let MIN_BRIGHTNESS = 0
//  Lowest brightness limit (0 to 255)
//  --- HEART RATE SENSOR SETUP (PIN 1) ---
let SENSOR_PIN = AnalogPin.P1
//  Connect KY-039 Signal (S) to P1 on Robotbit
let SAMPLE_DELAY_MS = 20
//  Safe 50Hz hardware sampling interval
let RAW_BASELINE = 317
//  Fixed directly to your stable hardware reading
let TRIGGER_DELTA = 6
//  2% spike detection line (317 * 0.02 approx 6)
//  --- STATE VARIABLES ---
let is_breathing = false
//  Tracks if the lights should be animating or off
let bpm = 55
//  Starts at a safe default under the 60 BPM trigger limit
let is_peak = false
let loop_counter = 0
//  Track time steps safely as plain integers
//  --- INITIALIZATION ---
//  Initialize the light strip
let strip = neopixel.create(SIGNAL_PIN, LED_COUNT, NeoPixelMode.RGB)
strip.clear()
strip.show()
//  Ensure Robotbit fan motor is completely off at start
robotbit.MotorRun(robotbit.Motors.M2A, 0)
//  Silence any sounds at startup
music.stopAllSounds()
function stop_everything() {
    
    is_breathing = false
    //  Stop the light strip completely
    strip.clear()
    strip.show()
    //  Shut down the motor on M2 port completely
    robotbit.MotorRun(robotbit.Motors.M2A, 0)
    //  Stop the micro:bit speaker audio immediately
    music.stopAllSounds()
    bpm = 55
}

//  Safe buffer reset so the sensor won't instantly re-trigger upon shutoff
basic.forever(function on_forever() {
    let time_gap_ms: number;
    let calculated_heart_rate: number;
    let current_dim_value: number;
    
    //  1. READ RAW ANALOG VOLTAGE (Your verified sensor code)
    let raw_input_value = pins.analogReadPin(SENSOR_PIN)
    loop_counter += 1
    //  Isolate voltage change
    let pulse_change = raw_input_value - RAW_BASELINE
    if (pulse_change < 0) {
        pulse_change = 0
    }
    
    //  2. CRASH-SAFE TIMING DETECTION LOGIC (Your verified sensor code)
    if (pulse_change > TRIGGER_DELTA) {
        if (!is_peak) {
            //  Convert loop counts to a real millisecond value (Loops * 20ms)
            time_gap_ms = loop_counter * SAMPLE_DELAY_MS
            loop_counter = 0
            //  Clear count immediately for the next wave
            is_peak = true
            //  Filter window: Only calculate if pulse is between 40 and 140 BPM
            if (time_gap_ms > 420 && time_gap_ms < 1500) {
                calculated_heart_rate = Math.idiv(60000, time_gap_ms)
                //  Smooth out jumps using a stable integer-based rolling average
                bpm = Math.idiv(bpm * 8 + calculated_heart_rate * 2, 10)
            }
            
            basic.showIcon(IconNames.Heart)
        }
        
    } else {
        //  If the wave drops below half the trigger line, unlock for the next beat
        if (pulse_change < Math.idiv(TRIGGER_DELTA, 2)) {
            is_peak = false
        }
        
        basic.showIcon(IconNames.SmallHeart)
    }
    
    //  Data logging output stream
    serial.writeValue("RAW_INPUT", raw_input_value)
    serial.writeValue("PULSE_SPIKE", pulse_change)
    serial.writeValue("LIVE_BPM", bpm)
    //  3. COMBINED DUO TRIGGER (BUTTON A PRESS OR SENSOR BPM > 60)
    if ((input.buttonIsPressed(Button.A) || bpm > 60) && !is_breathing) {
        is_breathing = true
        //  Spin up the motor on M2 port at full speed (255)
        robotbit.MotorRun(robotbit.Motors.M2A, 255)
        //  Set tempo to a very slow, calm 50 Beats Per Minute
        music.setTempo(50)
        //  Using a valid melody from the official MakeCode list
        music.beginMelody(music.builtInMelody(Melodies.Entertainer), MelodyOptions.ForeverInBackground)
        basic.pause(500)
    }
    
    //  Check if Button B was clicked to call the stop function
    if (input.buttonIsPressed(Button.B)) {
        stop_everything()
        basic.pause(500)
    }
    
    //  4. LIGHT STRIP BREATHING ROUTINE
    if (is_breathing) {
        //  1. FADE UP TO WHITE
        for (let brightness = MIN_BRIGHTNESS; brightness < MAX_BRIGHTNESS + 1; brightness++) {
            //  Check Button B inside the loop for an instant emergency cutoff
            if (input.buttonIsPressed(Button.B)) {
                stop_everything()
                break
            }
            
            //  Hardware-level color value scaling to avoid MakeCode brightness lock
            strip.showColor(neopixel.rgb(brightness, brightness, brightness))
            basic.pause(DELAY_MS)
        }
        //  Double check state before starting the fade down loop
        if (is_breathing) {
            //  2. FADE DOWN TO DARK
            for (let brightness2 = MIN_BRIGHTNESS; brightness2 < MAX_BRIGHTNESS + 1; brightness2++) {
                //  Check Button B inside the loop for an instant emergency cutoff
                if (input.buttonIsPressed(Button.B)) {
                    stop_everything()
                    break
                }
                
                current_dim_value = MAX_BRIGHTNESS - brightness2
                //  Hardware-level color value scaling to avoid MakeCode brightness lock
                strip.showColor(neopixel.rgb(current_dim_value, current_dim_value, current_dim_value))
                basic.pause(DELAY_MS)
            }
        }
        
    }
    
    basic.pause(10)
})
