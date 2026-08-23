package steps;

import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.response.Response;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertNotNull;

public class BookingSteps {

    private String baseUrl;
    private Response lastResponse;
    private Response firstBookingResponse;
    private Response secondBookingResponse;

    @Given("la API restful-booker esta disponible en {string}")
    public void la_api_esta_disponible_en(String url) {
        this.baseUrl = url;
        RestAssured.baseURI = url;
    }

    @When("creo una reserva con nombre {string} fechas {string} a {string} y precio {int}")
    public void creo_una_reserva(String firstname, String checkin, String checkout, int totalprice) {
        lastResponse = crearReserva(firstname, checkin, checkout, totalprice);
    }

    @Then("la respuesta tiene codigo de estado {int}")
    public void la_respuesta_tiene_codigo(int statusCode) {
        assertEquals(statusCode, lastResponse.getStatusCode());
    }

    @Then("la respuesta contiene un bookingid numerico")
    public void la_respuesta_contiene_bookingid() {
        Integer bookingId = lastResponse.jsonPath().get("bookingid");
        assertNotNull("Se esperaba un bookingid en la respuesta", bookingId);
    }

    @Then("los datos de la reserva devuelta coinciden con los enviados")
    public void los_datos_coinciden() {
        assertEquals("Camilo", lastResponse.jsonPath().getString("booking.firstname"));
        assertEquals(Integer.valueOf(150), lastResponse.jsonPath().get("booking.totalprice"));
        assertEquals("2026-09-01", lastResponse.jsonPath().getString("booking.bookingdates.checkin"));
        assertEquals("2026-09-05", lastResponse.jsonPath().getString("booking.bookingdates.checkout"));
    }

    @Given("ya existe una reserva con nombre {string} fechas {string} a {string}")
    public void ya_existe_una_reserva(String firstname, String checkin, String checkout) {
        firstBookingResponse = crearReserva(firstname, checkin, checkout, 200);
        assertEquals(200, firstBookingResponse.getStatusCode());
    }

    @When("intento crear otra reserva con nombre {string} fechas {string} a {string}")
    public void intento_crear_otra_reserva(String firstname, String checkin, String checkout) {
        secondBookingResponse = crearReserva(firstname, checkin, checkout, 200);
    }

    @Then("ambas reservas se crean sin validacion de solapamiento, confirmando el defecto DEF-01")
    public void confirmar_defecto_solapamiento() {
        // Documenta el comportamiento actual: ambas reservas se aceptan (200)
        // para el mismo rango de fechas, sin ningun tipo de conflicto/rechazo.
        // Ver DEF-01 / Riesgo R2 en el Master Test Plan, seccion 7.
        assertEquals(200, firstBookingResponse.getStatusCode());
        assertEquals(200, secondBookingResponse.getStatusCode());

        Integer firstId = firstBookingResponse.jsonPath().get("bookingid");
        Integer secondId = secondBookingResponse.jsonPath().get("bookingid");
        assertNotNull(firstId);
        assertNotNull(secondId);
        assertTrue("Se esperaban dos bookingid distintos para el mismo rango de fechas (evidencia del defecto DEF-01)",
                !firstId.equals(secondId));
    }

    private Response crearReserva(String firstname, String checkin, String checkout, int totalprice) {
        String payload = "{"
                + "\"firstname\":\"" + firstname + "\","
                + "\"lastname\":\"Test\","
                + "\"totalprice\":" + totalprice + ","
                + "\"depositpaid\":true,"
                + "\"bookingdates\":{"
                + "  \"checkin\":\"" + checkin + "\","
                + "  \"checkout\":\"" + checkout + "\""
                + "},"
                + "\"additionalneeds\":\"None\""
                + "}";

        return RestAssured.given()
                .header("Content-Type", "application/json")
                .body(payload)
                .post("/booking");
    }
}
