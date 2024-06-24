
module sui_place::place {
    
    use std::vector;
    use sui::object::{UID, new, uid_to_address};
    use sui::tx_context::{TxContext};
    use sui::transfer::share_object;
    use sui::dynamic_object_field;

    const EInvalidCoord: u64 = 0; // error codes

    public struct Place has key, store {
        id: UID
    }

    public struct Quadrant has key, store {
        id: UID,
        quadrant_id: u8,
        board: vector<vector<u32>>
    }

    fun make_row(length: u64): vector<u32> {
        // TODO
        // init empty vector
        let mut row= vector::empty<u32>();
        let mut i = 0;
        //append length number of #fffffff
        while (i < length) {            // #ffffff (hex) to decimal
            vector::push_back(&mut row, 16_777_215);
            i = i + 1;
        };
        //return vector
        row
    }

    fun make_quadrant_pixels(length: u64): vector<vector<u32>> {
        // inti empty vectors
        let mut grid: vector<vector<u32>> = vector::empty<vector<u32>>();
        // append result of call to make_row lenght times
        let mut i = 0;
        while (i < length) {            // #ffffff (hex) to decimal
            vector::push_back(&mut grid, make_row(length));
            i = i + 1;
        };
        grid
        // return vector
    }
    fun init(ctx: &mut TxContext) {
        // TODO
        //create  place object
        let mut place = Place {
            id: new(ctx)
        };
        //create four quadrants, init each pixel grid to white
        // place four quadrants as dynamic fields with quadarant id on place
        let mut i = 0;
        while (i < 4) {
            dynamic_object_field::add(
                &mut place.id, 
                i,
                Quadrant {
                    id: new(ctx),
                    quadrant_id: i,
                    board: make_quadrant_pixels(200)
                }
            );
            i = i + 1;
        };
        // make place shared object
        share_object(place);
    }

    public fun get_quadrant_id(x: u64, y: u64): u8 {
       if (x < 200) {
            if (y < 200) { 0 } else { 2 }
       } else {
            if (y < 200) { 1 } else { 3 }
       }
    }
    public fun set_pixel_at(place: &mut Place, x: u64, y: u64, colour: u32){
        //  TODO
        //assert that x,y is in bounds
        assert!(x < 400 && y < 400, EInvalidCoord);
        // get quadrant id from x,y
        let quadrant_id = get_quadrant_id(x, y);
        // get quadrant from dynamic field object mapping on place
        let quadrant = dynamic_object_field::borrow_mut<u8, Quadrant>(&mut place.id, quadrant_id);
        let pixel: &mut u32 = vector::borrow_mut(
            vector::borrow_mut(&mut quadrant.board, x % 200),
             y % 200);
        // place the pixel in the quadrant
        *pixel = colour;
    }

    public fun get_quadrants(place: &Place): vector<address>{
        
        let mut addresses = vector::empty<address>();

        // go from 0 to 3
        let mut  i = 0;

        // lookup quadrant in object mapping from quadrant id
        // append id of each quadrant to vector
        while (i < 4){
            
            let quadrant = dynamic_object_field::borrow<u8, Quadrant>(&place.id, i);
            let quadrant_address = uid_to_address(&quadrant.id);
            vector::push_back(&mut addresses, quadrant_address);
            i = i+1;
            
        };

        // return vector
        addresses
    }
}