import { ComponentFixture, TestBed } from '@angular/core/testing';
// El componente depende de AuthService -> HttpClient: sin provideHttpClient el
// TestBed fallaba con "No provider for HttpClient" (dependencia que ya existía;
// la prueba no la declaraba).
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { EntregasComponent } from './entregas.component';

describe('EntregasComponent', () => {
  let component: EntregasComponent;
  let fixture: ComponentFixture<EntregasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntregasComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntregasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
