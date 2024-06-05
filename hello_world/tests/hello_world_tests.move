
#[test_only]
module hello_world::hello_world_tests {
    // uncomment this line to import the module
    use hello_world::hello_world;

    #[test]
    fun test_hello_world() {
        assert!(hello_world::hello_world() == b"Hello, World!".to_string(), 0)
    }


}
